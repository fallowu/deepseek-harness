// @vitest-environment jsdom
/**
 * Skills settings section behavior: the store settles every load outcome into
 * a visible state — rows on success, the wire error inline on business
 * failure, the no-session hint without an RPC — and the section guards its
 * inject face. The settled-outcome cases pin the mutator contract of
 * createSnapshotStore.update (draft mutation, not a returned replacement):
 * a returning mutator is a silent no-op, which froze the page at
 * "Refreshing…" with neither rows nor error.
 */
import { useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { SkillEntry } from '@deepseek-ai/dsh-api-remotes/client'
import { SkillSettingsSection } from '../src/client/SkillSettingsSection.tsx'
import { SkillSettingsStore, type SkillSettingsState } from '../src/client/settings-store.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

type ListResult =
  | { ok: true; value: { skills: SkillEntry[] } }
  | { ok: false; error: { code: string; message: string; details: object } }

const t = (key: keyof typeof en): string => en[key]

const SKILLS: SkillEntry[] = [
  { name: 'commit-helper', description: 'commit flow', modelInvocable: true },
  { name: 'local-only', description: '', modelInvocable: false },
]

/** Sessions-list face naming the current session (undefined = none). */
function sessionsWith(current: string | undefined) {
  return { list: { getSnapshot: () => ({ current: current as SessionId | undefined }) } }
}

/** Bind the uSES adapter over the store the way web-react does at register. */
function hookOver(store: SkillSettingsStore['store']) {
  return function useSelector<S>(selector: (state: SkillSettingsState) => S): S {
    return useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot()))
  }
}

function mount(controller: SkillSettingsStore) {
  return render(
    <SkillSettingsSection
      controller={controller}
      useSnapshot={hookOver(controller.store)}
      t={t}
    />,
  )
}

describe('SkillSettingsStore through the section', () => {
  it('settles a successful load into rendered rows', async () => {
    const list = vi.fn(() => Promise.resolve<{ result: ListResult }>({
      result: { ok: true, value: { skills: SKILLS } },
    }))
    const controller = new SkillSettingsStore(
      { skills: { list: list as never } },
      sessionsWith('s1') as never,
    )
    const view = mount(controller)
    await waitFor(() => { expect(view.getByRole('list')).toBeTruthy() })
    // Both rows render; the user-only entry wears its badge, the empty
    // description stays absent, and the refresh control re-enables.
    expect(view.getByText('commit-helper')).toBeTruthy()
    expect(view.getByText('local-only')).toBeTruthy()
    expect(view.getByText(t('settings.userOnly')).textContent).not.toHaveLength(0)
    expect(view.queryByText('commit flow')).toBeTruthy()
    expect(view.getByRole('button', { name: t('settings.refresh') }).hasAttribute('disabled')).toBe(false)
    expect(list).toHaveBeenCalledWith({ sessionId: 's1' })
  })

  it('settles a failed load into the inline error instead of staying at Refreshing…', async () => {
    const controller = new SkillSettingsStore(
      {
        skills: {
          list: () => Promise.resolve<{ result: ListResult }>({
            result: { ok: false, error: { code: 'session-not-found', message: 'session "s1" not found (not attached)', details: {} } },
          }),
        },
      } as never,
      sessionsWith('s1') as never,
    )
    const view = mount(controller)
    await waitFor(() => { expect(view.getByText('session "s1" not found (not attached)')).toBeTruthy() })
    expect(view.getByRole('button', { name: t('settings.refresh') }).hasAttribute('disabled')).toBe(false)
    expect(view.queryByRole('list')).toBeNull()
  })

  it('names the session prerequisite without an RPC when none is current', async () => {
    const list = vi.fn()
    const controller = new SkillSettingsStore(
      { skills: { list: list as never } },
      sessionsWith(undefined) as never,
    )
    const view = mount(controller)
    await waitFor(() => { expect(view.getByText(t('settings.noSession'))).toBeTruthy() })
    expect(list).not.toHaveBeenCalled()
  })

  it('marks a ready empty catalog explicitly', async () => {
    const controller = new SkillSettingsStore(
      { skills: { list: () => Promise.resolve<{ result: ListResult }>({ result: { ok: true, value: { skills: [] } } }) } as never },
      sessionsWith('s1') as never,
    )
    const view = mount(controller)
    await waitFor(() => { expect(view.getByText(t('settings.empty'))).toBeTruthy() })
  })

  it('renders nothing until the inject face is complete', () => {
    const view = render(<SkillSettingsSection t={t} />)
    expect(view.container.firstChild).toBeNull()
  })
})
