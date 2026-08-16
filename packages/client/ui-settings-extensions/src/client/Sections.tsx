/**
 * Management pages for the custom extension surfaces: the MCP server fleet
 * (the 'mcp-servers' settings section the dsh-custom-mcp-client/servers
 * reconciler mounts) and the skill discovery filters (the 'skill-filters'
 * section dsh-custom-skill-filesystem applies live). Both pages read through
 * settings describe and write through settings mutate with the section
 * revision, exactly like the Models page's provider cards.
 */

import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'
import { en, zh, type ExtensionsKey } from './locales.ts'
import styles from './sections.module.css'

/** Namespace view shape this page reads (the wire's SettingsNamespaceView). */
interface NamespaceView {
  ns: string
  value: unknown
  revision: number
}

/** Injected share both sections receive. */
export interface ExtensionsInjected {
  api: Pick<IApiClient, 'settings'>
  t: (key: ExtensionsKey, params?: Record<string, string | number>) => string
}

/** Load one namespace view, or undefined with the failure message set. */
async function loadNamespace(
  api: ExtensionsInjected['api'],
  ns: string,
): Promise<{ view?: NamespaceView; error?: string }> {
  try {
    const response = await api.settings.describe({})
    if (!response.result.ok) return { error: response.result.error.message }
    const view = response.result.value.namespaces.find(entry => entry.ns === ns)
    return view === undefined ? {} : { view }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/** Persist one whole-section value at the observed revision. */
async function saveNamespace(
  api: ExtensionsInjected['api'],
  ns: string,
  value: unknown,
  revision: number,
): Promise<string | undefined> {
  try {
    const response = await api.settings.mutate({
      ns,
      ops: [{ op: 'set' as const, path: [], value }],
      expectedRevision: revision,
    })
    if (!response.result.ok) return response.result.error.message
    return undefined
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

/** One fleet entry as the page edits it. */
interface ServerDraft {
  transport: 'stdio' | 'streamable-http'
  command: string
  args: string
  url: string
}

/** Read the fleet document into editable drafts, keeping unknown fields aside. */
function draftsOf(view: unknown): { servers: Record<string, ServerDraft>; raw: Record<string, Record<string, unknown>> } {
  const document = typeof view === 'object' && view !== null ? (view as { servers?: unknown }).servers : undefined
  const raw: Record<string, Record<string, unknown>> = {}
  const servers: Record<string, ServerDraft> = {}
  if (typeof document === 'object' && document !== null) {
    for (const [name, entry] of Object.entries(document as Record<string, unknown>)) {
      if (typeof entry !== 'object' || entry === null) continue
      const record = entry as Record<string, unknown>
      raw[name] = record
      servers[name] = {
        transport: record.transport === 'streamable-http' ? 'streamable-http' : 'stdio',
        command: typeof record.command === 'string' ? record.command : '',
        args: Array.isArray(record.args) ? record.args.join(' ') : '',
        url: typeof record.url === 'string' ? record.url : '',
      }
    }
  }
  return { servers, raw }
}

/** The MCP fleet page: one card per configured server plus an add row. */
export function McpSection({ api, t }: ExtensionsInjected): ReactNode {
  const [servers, setServers] = useState<Record<string, ServerDraft>>({})
  const [raw, setRaw] = useState<Record<string, Record<string, unknown>>>({})
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState('')

  const reload = useCallback(() => {
    setStatus('loading')
    void loadNamespace(api, 'mcp-servers').then((result) => {
      if (result.error !== undefined) {
        setFailure(result.error)
        setStatus('error')
        return
      }
      const parsed = draftsOf(result.view?.value)
      setServers(parsed.servers)
      setRaw(parsed.raw)
      setRevision(result.view?.revision ?? 0)
      setStatus('ready')
    })
  }, [api])

  useEffect(() => { reload() }, [reload])

  const save = (): void => {
    setBusy(true)
    const value: Record<string, Record<string, unknown>> = {}
    for (const [name, draft] of Object.entries(servers)) {
      const base = raw[name] ?? {}
      value[name] = {
        ...base,
        transport: draft.transport,
        ...(draft.transport === 'stdio'
          ? { command: draft.command, args: draft.args.length === 0 ? [] : draft.args.split(/\s+/) }
          : { url: draft.url }),
      }
    }
    void saveNamespace(api, 'mcp-servers', { servers: value }, revision).then((message) => {
      setBusy(false)
      if (message !== undefined) { setFailure(message); return }
      setFailure(undefined)
      reload()
    })
  }

  const patch = (name: string, next: Partial<ServerDraft>): void => {
    setServers(current => ({ ...current, [name]: { ...current[name], ...next } }))
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>{t('mcp.title')}</h3>
      <p className={styles.intro}>{t('mcp.intro')}</p>
      {status === 'error' ? <p className={styles.error}>{failure}</p> : null}
      {Object.entries(servers).map(([name, draft]) => (
        <div key={name} className={styles.row}>
          <div className={styles.rowHead}>
            <span className={styles.name}>{name}</span>
            <button
              type="button" className={styles.link}
              onClick={() => { setServers((current) => { const { [name]: _, ...rest } = current; return rest }) }}
            >
              {t('mcp.remove')}
            </button>
          </div>
          <div className={styles.fields}>
            <select
              value={draft.transport}
              aria-label={t('mcp.transport')}
              onChange={(event) => { patch(name, { transport: event.target.value as ServerDraft['transport'] }) }}
            >
              <option value="stdio">stdio</option>
              <option value="streamable-http">streamable-http</option>
            </select>
            {draft.transport === 'stdio'
              ? (
                <>
                  <input
                    value={draft.command} placeholder="command"
                    aria-label={t('mcp.command')}
                    onChange={(event) => { patch(name, { command: event.target.value }) }}
                  />
                  <input
                    value={draft.args} placeholder="arguments"
                    aria-label={t('mcp.args')}
                    onChange={(event) => { patch(name, { args: event.target.value }) }}
                  />
                </>
              )
              : (
                <input
                  value={draft.url} placeholder="https://host/mcp"
                  aria-label={t('mcp.url')}
                  onChange={(event) => { patch(name, { url: event.target.value }) }}
                />
              )}
          </div>
        </div>
      ))}
      <div className={styles.addRow}>
        <input
          value={added} placeholder={t('mcp.namePlaceholder')}
          aria-label={t('mcp.name')}
          onChange={(event) => { setAdded(event.target.value) }}
        />
        <button
          type="button"
          disabled={added.trim() === '' || servers[added.trim()] !== undefined}
          onClick={() => {
            const name = added.trim()
            if (name === '' || servers[name] !== undefined) return
            setServers(current => ({ ...current, [name]: { transport: 'stdio', command: '', args: '', url: '' } }))
            setAdded('')
          }}
        >
          {t('mcp.add')}
        </button>
      </div>
      <div className={styles.footer}>
        <button type="button" disabled={busy || status !== 'ready'} onClick={save}>
          {busy ? t('saving') : t('apply')}
        </button>
        {failure !== undefined && status !== 'error' ? <span className={styles.error}>{failure}</span> : null}
      </div>
    </section>
  )
}

/** Every discovery source the skill provider knows, with its meaning. */
const SKILL_SOURCES = ['project-dsh', 'project-agents', 'custom', 'user-dsh', 'user-agents', 'bundled'] as const

/** The skill filters page: source whitelist plus name exclusions. */
export function SkillsSection({ api, t }: ExtensionsInjected): ReactNode {
  const [included, setIncluded] = useState<ReadonlySet<string>>(new Set(SKILL_SOURCES))
  const [excludeText, setExcludeText] = useState('')
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => {
    setStatus('loading')
    void loadNamespace(api, 'skill-filters').then((result) => {
      if (result.error !== undefined) {
        setFailure(result.error)
        setStatus('error')
        return
      }
      const value = result.view?.value
      const document = typeof value === 'object' && value !== null ? value as { includeSources?: unknown; excludeNames?: unknown } : {}
      const sources = Array.isArray(document.includeSources)
        ? document.includeSources.filter((entry): entry is string => typeof entry === 'string')
        : [...SKILL_SOURCES]
      setIncluded(new Set(sources))
      setExcludeText(Array.isArray(document.excludeNames)
        ? document.excludeNames.filter((entry): entry is string => typeof entry === 'string').join('\n')
        : '')
      setRevision(result.view?.revision ?? 0)
      setStatus('ready')
    })
  }, [api])

  useEffect(() => { reload() }, [reload])

  const save = (): void => {
    setBusy(true)
    const value = {
      includeSources: [...included],
      excludeNames: excludeText.split('\n').map(line => line.trim()).filter(line => line !== ''),
    }
    void saveNamespace(api, 'skill-filters', value, revision).then((message) => {
      setBusy(false)
      if (message !== undefined) { setFailure(message); return }
      setFailure(undefined)
      reload()
    })
  }

  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>{t('skills.title')}</h3>
      <p className={styles.intro}>{t('skills.intro')}</p>
      {status === 'error' ? <p className={styles.error}>{failure}</p> : null}
      <div className={styles.sources}>
        {SKILL_SOURCES.map(source => (
          <label key={source} className={styles.source}>
            <input
              type="checkbox"
              checked={included.has(source)}
              onChange={() => {
                setIncluded((current) => {
                  const next = new Set(current)
                  if (!next.delete(source)) next.add(source)
                  return next
                })
              }}
            />
            <span>{t('skills.source.' + source)}</span>
          </label>
        ))}
      </div>
      <label className={styles.textBlock}>
        <span>{t('skills.exclude')}</span>
        <textarea
          rows={4}
          value={excludeText}
          placeholder={'okx-*\nmy-private-skill'}
          onChange={(event) => { setExcludeText(event.target.value) }}
        />
      </label>
      <div className={styles.footer}>
        <button type="button" disabled={busy || status !== 'ready'} onClick={save}>
          {busy ? t('saving') : t('apply')}
        </button>
        {failure !== undefined && status !== 'error' ? <span className={styles.error}>{failure}</span> : null}
      </div>
    </section>
  )
}

export { en, zh }
export type { ExtensionsKey }
