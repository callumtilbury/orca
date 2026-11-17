import { afterEach, expect, it, vi } from 'vitest'
import { callPluginHost, pluginHostTestServices } from './__mocks__/plugin-host-services-fixture'
import {
  getPluginHostRendererActions,
  setPluginHostRendererRequest
} from '../../view/plugin-host-renderer-actions'

const document = {
  documentId: 'native-1',
  workspaceId: 'folder:notes',
  path: '/notes/main.typ',
  relativePath: 'main.typ',
  languageId: 'typst',
  runtimeEnvironmentId: null,
  executionHostId: 'local',
  version: 3,
  readOnly: false,
  text: '= Unsaved text',
  tooLarge: false,
  selection: { start: { line: 0, character: 2 }, end: { line: 0, character: 9 } }
}
afterEach(() => setPluginHostRendererRequest(null))

it('requires explicit editor access before exposing an unsaved native buffer', async () => {
  setPluginHostRendererRequest(async () => ({ requestId: 'r', ok: true, document }))
  const services = pluginHostTestServices(vi.fn(), { renderer: getPluginHostRendererActions() })
  expect(
    await callPluginHost({
      method: 'editor.readActive',
      params: {},
      granted: ['workspace:read'],
      services
    })
  ).toMatchObject({ code: 'capability_denied' })
  expect(
    await callPluginHost({
      method: 'editor.readActive',
      params: {},
      granted: ['editor:read'],
      services
    })
  ).toMatchObject({ value: { text: '= Unsaved text', version: 3 } })
})

it('requires workspace write access to reveal a range and reports a stale target', async () => {
  setPluginHostRendererRequest(async () => ({ requestId: 'r', ok: true, revealed: false }))
  const services = pluginHostTestServices(vi.fn(), { renderer: getPluginHostRendererActions() })
  const params = {
    documentId: 'native-1',
    range: { start: { line: 0, character: 2 }, end: { line: 0, character: 9 } }
  }
  expect(
    await callPluginHost({ method: 'editor.reveal', params, granted: ['editor:read'], services })
  ).toMatchObject({ code: 'capability_denied' })
  expect(
    await callPluginHost({
      method: 'editor.reveal',
      params,
      granted: ['workspace:write'],
      services
    })
  ).toMatchObject({ value: { revealed: false } })
})
