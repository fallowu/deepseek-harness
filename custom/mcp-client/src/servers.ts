/**
 * Settings-driven MCP server fleet: one plugin entry that reads the
 * 'mcp-servers' settings section (a dict keyed by serverName; each value is
 * the single-server transport config) and keeps one single-server child fiber
 * per entry mounted. The settings page edits the section; this reconciler
 * mounts, replaces, and disposes servers as the document changes, with no
 * host restart.
 *
 * @module dsh-custom-mcp-client/servers
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import * as single from './index.ts'
import type { Config as SingleConfig } from './index.ts'

/** Settings namespace holding the server fleet document. */
export const MCP_SERVERS_SETTINGS_NAMESPACE = settingsNamespace('mcp-servers')

/** One server entry: the single-server config minus the redundant serverName. */
interface ServerEntry {
  transport: 'stdio' | 'streamable-http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  toolCallTimeoutMs?: number
  failOnStartupError?: boolean
  resources?: boolean
  prompts?: boolean
}

/** Schema of one fleet entry (union of both transports; serverName comes from the dict key). */
const entrySchema = z.object({
  transport: z.union(['stdio', 'streamable-http']),
  command: z.string(),
  args: z.array(String).default([]),
  env: z.dict(String).default({}),
  cwd: z.string().default(''),
  url: z.string(),
  headers: z.dict(String).default({}),
  toolCallTimeoutMs: z.number().default(60000),
  failOnStartupError: z.boolean().default(false),
  resources: z.boolean().default(true),
  prompts: z.boolean().default(true),
})

/** The fleet document: serverName -> entry. */
export interface FleetDocument {
  servers?: Record<string, ServerEntry>
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'mcp-client-servers'

/** Services required by this plugin. */
export const inject = ['settings']

// Side-effect type import: declaration-merges ctx.settings onto Context.
import type {} from '@deepseek-ai/dsh-settings'

/**
 * Mount one child fiber per settings entry, reconciling on every change.
 * @param ctx - plugin context.
 * @param _config - placeholder plugin config (the fleet lives in settings).
 */
export function apply(ctx: Context, _config: FleetDocument): void {
  const fibers = new Map<string, { dispose(): Promise<void>, config: unknown }>()

  const reconcile = (document: FleetDocument): void => {
    const next = document.servers ?? {}
    for (const [serverName, fiber] of fibers) {
      if (next[serverName] === undefined) {
        fibers.delete(serverName)
        void fiber.dispose()
      }
    }
    for (const [serverName, entry] of Object.entries(next)) {
      const mounted = fibers.get(serverName)
      if (mounted !== undefined && sameEntry(mounted.config, entry)) continue
      if (mounted !== undefined) {
        fibers.delete(serverName)
        void mounted.dispose()
      }
      const config = { ...entry, serverName } as unknown as SingleConfig
      const fiber = ctx.plugin(single, config)
      fibers.set(serverName, { dispose: () => fiber.dispose(), config })
    }
  }

  /** Shallow compare that treats an absent optional as equal to an empty one. */
  function sameEntry(a: unknown, b: ServerEntry): boolean {
    if (typeof a !== 'object' || a === null) return false
    const left = { ...(a as Record<string, unknown>) }
    const right = { ...(b as Record<string, unknown>) }
    delete left.serverName
    delete right.serverName
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    for (const key of keys) {
      if (JSON.stringify(left[key] ?? null) !== JSON.stringify(right[key] ?? null)) return false
    }
    return true
  }

  // Register directly with the settings service: registration resolves the
  // current document once, and the scope watch re-reconciles on every publish
  // (the provider reads settings.yaml asynchronously, so the first value can
  // land either side of this registration).
  const scope = ctx.settings.register(MCP_SERVERS_SETTINGS_NAMESPACE, z.object({ servers: z.dict(entrySchema) }), { base: { servers: {} } })
  ctx.logger.info('mcp-fleet: registered, initial=' + JSON.stringify(scope.get()))
  reconcile(scope.get() as FleetDocument)
  scope.watch(() => {
    ctx.logger.info('mcp-fleet: document changed to ' + JSON.stringify(scope.get()))
    reconcile(scope.get() as FleetDocument)
  })

  ctx.effect(() => () => {
    for (const fiber of fibers.values()) void fiber.dispose()
    fibers.clear()
  }, 'mcp-client-servers fleet')
}
