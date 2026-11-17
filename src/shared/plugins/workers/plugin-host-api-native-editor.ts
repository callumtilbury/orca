import { z } from 'zod'
import { ALL_SURFACES, WORKER_ONLY, spec } from './plugin-host-method-spec'

// Provisional floor for this native editor API; not a stock-release claim.
export const PLUGIN_NATIVE_EDITOR_SINCE = '1.4.262'
export const PLUGIN_NATIVE_EDITOR_TEXT_LIMIT = 128 * 1024
const position = z.strictObject({
  line: z.number().int().nonnegative(),
  character: z.number().int().nonnegative()
})
export const pluginEditorRangeSchema = z.strictObject({ start: position, end: position })
export const pluginNativeEditorDocumentSchema = z.strictObject({
  documentId: z.string().min(1).max(8192),
  workspaceId: z.string().max(8192).nullable(),
  path: z.string().max(32768),
  relativePath: z.string().max(32768),
  languageId: z.string().max(256),
  runtimeEnvironmentId: z.string().max(8192).nullable(),
  executionHostId: z.string().max(8192).nullable(),
  version: z.number().int().nonnegative(),
  readOnly: z.boolean(),
  selection: pluginEditorRangeSchema,
  text: z.string().max(PLUGIN_NATIVE_EDITOR_TEXT_LIMIT).nullable(),
  tooLarge: z.boolean()
})
export type PluginNativeEditorDocument = z.infer<typeof pluginNativeEditorDocumentSchema>
export const pluginNativeEditorChangedSchema = z.strictObject({
  documentId: z.string().max(8192).nullable(),
  reason: z.enum(['active', 'content', 'selection', 'locate'])
})
export type PluginNativeEditorChanged = z.infer<typeof pluginNativeEditorChangedSchema>
export const PLUGIN_NATIVE_EDITOR_API = {
  'editor.readActive': spec({
    summary:
      'Reads the active native editor document, including unsaved text and its selection. Positions use zero-based UTF-16 offsets. Text is null above 128 Ki characters; tooLarge reports that limit.',
    since: 11,
    scope: 'desktop',
    capability: 'editor:read',
    mutation: false,
    surfaces: ALL_SURFACES,
    params: z.strictObject({}).optional(),
    result: pluginNativeEditorDocumentSchema.nullable()
  }),
  'editor.reveal': spec({
    summary:
      'Selects and reveals a range in the active native editor. Refuses stale document identities. Positions use zero-based UTF-16 offsets.',
    since: 11,
    scope: 'desktop',
    capability: 'workspace:write',
    mutation: true,
    surfaces: WORKER_ONLY,
    params: z.strictObject({
      documentId: z.string().min(1).max(8192),
      range: pluginEditorRangeSchema
    }),
    result: z.strictObject({ revealed: z.boolean() })
  })
}
