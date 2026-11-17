import type { editor } from 'monaco-editor'
import { useAppStore } from '@/store'
import { usePluginPanelsStore } from '@/store/plugins/catalog/plugin-contribution-catalog'
import { resolveEditorModelOwner } from '../model-lifetime/identity/editor-model-owner'
import {
  PLUGIN_NATIVE_EDITOR_TEXT_LIMIT,
  type PluginNativeEditorChanged,
  type PluginNativeEditorDocument
} from '../../../../../shared/plugins/workers/plugin-host-api-native-editor'

const editors = new Set<{ instance: editor.IStandaloneCodeEditor; fileId: () => string }>()

function activeEditor() {
  const state = useAppStore.getState()
  const file = state.openFiles.find(
    (file) => file.id === state.activeFileId && file.mode === 'edit'
  )
  const instance = file && [...editors].find((binding) => binding.fileId() === file.id)?.instance
  const model = instance?.getModel()
  return file && instance && model ? { state, file, instance, model } : null
}

export function readNativePluginDocument(): PluginNativeEditorDocument | null {
  const active = activeEditor()
  if (!active) {
    return null
  }
  const { state, file, instance, model } = active
  const selection = instance.getSelection()
  if (!selection) {
    return null
  }
  const owner = resolveEditorModelOwner(file, state)
  const tooLarge = model.getValueLength() > PLUGIN_NATIVE_EDITOR_TEXT_LIMIT
  return {
    documentId: file.id,
    workspaceId: file.worktreeId || null,
    path: file.filePath,
    relativePath: file.relativePath,
    languageId: model.getLanguageId(),
    runtimeEnvironmentId: owner.environmentId,
    executionHostId: owner.hostId,
    version: model.getVersionId(),
    readOnly: file.readOnly === true,
    selection: {
      start: { line: selection.startLineNumber - 1, character: selection.startColumn - 1 },
      end: { line: selection.endLineNumber - 1, character: selection.endColumn - 1 }
    },
    text: tooLarge ? null : model.getValue(),
    tooLarge
  }
}

export function revealNativePluginRange(
  documentId: string,
  range: PluginNativeEditorDocument['selection']
): boolean {
  const active = activeEditor()
  if (!active || active.file.id !== documentId) {
    return false
  }
  const selection = active.model.validateRange({
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1
  })
  active.instance.setSelection(selection)
  active.instance.revealRangeInCenter(selection)
  active.instance.focus()
  return true
}

function wantsNativeEditorEvents(): boolean {
  return usePluginPanelsStore
    .getState()
    .plugins.some(
      (plugin) =>
        ['running', 'idle', 'restarting'].includes(plugin.status) &&
        !plugin.needsReconsent &&
        plugin.capabilities.some((capability) => capability.kind === 'editor:read')
    )
}

function notify(reason: PluginNativeEditorChanged['reason']): void {
  if (!wantsNativeEditorEvents()) {
    return
  }
  void window.api?.plugins
    ?.nativeEditorChanged?.({ documentId: activeEditor()?.file.id ?? null, reason })
    .catch(() => {})
}

export function registerNativePluginEditor(
  instance: editor.IStandaloneCodeEditor,
  fileId: () => string
): () => void {
  let pendingReason: PluginNativeEditorChanged['reason'] = 'active'
  let timer: ReturnType<typeof setTimeout> | undefined
  const binding = { instance, fileId }
  editors.add(binding)
  function schedule(reason: PluginNativeEditorChanged['reason']) {
    if (!wantsNativeEditorEvents() || useAppStore.getState().activeFileId !== fileId()) {
      return
    }
    if (reason === 'locate' || pendingReason !== 'locate') {
      pendingReason = reason
    }
    clearTimeout(timer)
    timer = setTimeout(
      () => {
        notify(pendingReason)
        pendingReason = 'active'
      },
      pendingReason === 'locate' ? 0 : 100
    )
  }
  const subscriptions = [
    instance.onDidChangeModelContent(() => schedule('content')),
    instance.onDidChangeCursorSelection(() => schedule('selection')),
    instance.onMouseDown((event) => {
      if (event.event.detail === 2 && event.target.position) {
        schedule('locate')
      }
    }),
    useAppStore.subscribe((state, previous) => {
      if (state.activeFileId !== previous.activeFileId) {
        schedule('active')
      }
    })
  ]
  schedule('active')
  return () => {
    clearTimeout(timer)
    for (const subscription of subscriptions) {
      if (typeof subscription === 'function') {
        subscription()
      } else {
        subscription.dispose()
      }
    }
    editors.delete(binding)
    notify('active')
  }
}
