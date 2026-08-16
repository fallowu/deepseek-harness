/**
 * Extensions settings plugin, browser half: registers the MCP-servers and
 * skill-filters management sections on the settings page. Both write through
 * the settings wire (describe/mutate with section revisions), so the host
 * reconcilers (dsh-custom-mcp-client/servers, dsh-custom-skill-filesystem)
 * apply changes live.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { McpSection, SkillsSection } from './Sections.tsx'
import type { ExtensionsInjected } from './Sections.tsx'
import { en, zh, type ExtensionsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The extensions settings sections copy. */
    'settings.extensions': ExtensionsKey
  }
}

const NS = 'settings.extensions'

export const inject = ['slots', 'locale', 'connection']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-extensions: copy dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const t = ctx.locale.bind(NS) as ExtensionsInjected['t']
  const injected = (): ExtensionsInjected => ({ api: connection.api, t })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'mcp-servers',
    order: 11,
    label: () => t('mcp.nav'),
    inject: injected,
  }, McpSection))
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skill-filters',
    order: 12,
    label: () => t('skills.nav'),
    inject: injected,
  }, SkillsSection))
}
