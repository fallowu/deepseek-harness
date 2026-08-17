/**
 * Skills settings page store: one snapshot of the current session's
 * user-invocable skill catalog (skill.list wire; the host resolves the
 * project root from the session header). The host stays the single fact
 * source; the page refetches on mount and manual refresh.
 */

import type { IApiClient, SkillEntry } from '@deepseek-ai/dsh-api-remotes/client'
import type { ISessions, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** State rendered by the Skills settings section. */
export interface SkillSettingsState {
  status: 'idle' | 'loading' | 'ready' | 'no-session' | 'error'
  error: string | null
  skills: readonly SkillEntry[]
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Loads the current session's skill catalog through the wire. */
export class SkillSettingsStore {
  /** uSES-safe state source shared by the registered settings section. */
  readonly store: SnapshotStore<SkillSettingsState> = createSnapshotStore({
    status: 'idle', error: null, skills: [],
  })

  private generation = 0

  private readonly api: Pick<IApiClient, 'skills'>
  private readonly sessions: Pick<ISessions, 'list'>

  /**
   * @param api - skills wire face.
   * @param sessions - sessions service; its list snapshot names the current session.
   */
  constructor(api: Pick<IApiClient, 'skills'>, sessions: Pick<ISessions, 'list'>) {
    this.api = api
    this.sessions = sessions
  }

  /**
   * Fetch the catalog for the current session's project.
   * @returns nothing; the snapshot carries the outcome.
   */
  async load(): Promise<void> {
    const generation = ++this.generation
    const sessionId = this.sessions.list.getSnapshot().current
    if (sessionId === undefined) {
      this.store.update((s) => { s.status = 'no-session'; s.error = null; s.skills = [] })
      return
    }
    this.store.update((s) => { s.status = 'loading'; s.error = null })
    try {
      const response = await this.api.skills.list({ sessionId })
      if (generation !== this.generation) return
      if (!response.result.ok) throw new Error(response.result.error.message)
      const skills = response.result.value.skills
      this.store.update((s) => { s.status = 'ready'; s.error = null; s.skills = skills })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((s) => { s.status = 'error'; s.error = messageOf(error); s.skills = [] })
    }
  }
}
