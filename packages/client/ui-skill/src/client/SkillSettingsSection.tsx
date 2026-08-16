/**
 * Skills settings section: the current project's user-invocable skill catalog.
 * Rows show each skill's name, routing description, and user-only mark; the
 * catalog is project-resolved (the host reads the session header's cwd), so a
 * no-session state names the prerequisite instead of an empty list.
 */

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-web-react'
import type { SkillEntry } from '@deepseek-ai/dsh-api-remotes/client'
import type { SkillSettingsState, SkillSettingsStore } from './settings-store.ts'
import type { en } from './locales.ts'
import styles from './settings.module.css'

/** Injected dependencies of the Skills settings section (slot inject). */
export interface SkillsSectionInjected {
  /** Page store (loaded on mount, refetched on refresh). */
  controller: SkillSettingsStore
  /** uSES subscription hook bound to the store. */
  useSnapshot: SnapshotSelectorHook<SkillSettingsState>
  /** Section copy. */
  t: (key: keyof typeof en) => string
}

/** Props delivered by the slot outlet: the inject face spread flat. */
export type SkillsSectionProps = Partial<SkillsSectionInjected>

/** One catalog row. */
function SkillRowView({ skill, t }: { skill: SkillEntry; t: SkillsSectionInjected['t'] }): ReactNode {
  return (
    <li className={styles.row}>
      <div className={styles.rowHead}>
        <span className={styles.name}>{skill.name}</span>
        {skill.modelInvocable ? null : <span className={styles.userOnly}>{t('settings.userOnly')}</span>}
      </div>
      {skill.description.length > 0 ? <p className={styles.description}>{skill.description}</p> : null}
    </li>
  )
}

/** The Skills settings section body (props-complete inner mount). */
function LoadedSection({
  controller, useSnapshot, t,
}: SkillsSectionInjected): ReactNode {
  const state = useSnapshot(s => s)
  useEffect(() => { void controller.load() }, [controller])

  return (
    <section className={styles.section} aria-label={t('settings.title')}>
      <div className={styles.header}>
        <h3 className={styles.heading}>{t('settings.title')}</h3>
        <Button
          variant="outline"
          disabled={state.status === 'loading'}
          onClick={() => { void controller.load() }}
        >
          {state.status === 'loading' ? t('settings.refreshing') : t('settings.refresh')}
        </Button>
      </div>
      <p className={styles.intro}>{t('settings.intro')}</p>
      {state.status === 'error' ? <p className={styles.error}>{state.error}</p> : null}
      {state.status === 'no-session'
        ? <p className={styles.hint}>{t('settings.noSession')}</p>
        : null}
      {state.status === 'ready' && state.skills.length === 0
        ? <p className={styles.hint}>{t('settings.empty')}</p>
        : null}
      {state.status === 'ready' && state.skills.length > 0
        ? (
          <ul className={styles.list}>
            {state.skills.map(skill => <SkillRowView key={skill.name} skill={skill} t={t} />)}
          </ul>
        )
        : null}
    </section>
  )
}

/** The registered section: guards the inject face, then mounts complete props. */
export function SkillSettingsSection(props: SkillsSectionProps): ReactNode {
  const { controller, useSnapshot, t } = props
  if (controller === undefined || useSnapshot === undefined || t === undefined) return null
  return <LoadedSection controller={controller} useSnapshot={useSnapshot} t={t} />
}
