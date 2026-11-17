import { ipcMain } from 'electron'
import type { PluginService } from '../../plugins/plugin-service'
import { pluginNativeEditorChangedSchema } from '../../../shared/plugins/workers/plugin-host-api-native-editor'

export function registerPluginNativeEditorHandler(service: PluginService): void {
  ipcMain.handle('plugins:nativeEditorChanged', (_event, payload: unknown) => {
    const parsed = pluginNativeEditorChangedSchema.safeParse(payload)
    if (parsed.success && service.wantsEvent('editor.changed')) {
      service.emitEvent('editor.changed', parsed.data)
    }
  })
}
