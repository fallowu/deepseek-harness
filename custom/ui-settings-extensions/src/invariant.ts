/**
 * Package-owned invariant companion for `dsh-custom-ui-settings-extensions`.
 * @module dsh-custom-ui-settings-extensions/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-custom-ui-settings-extensions'

/** Cordis companion plugin name. */
export const name = 'ui-settings-extensions-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the extensions settings plugin is browser-only —
 * its host entry exports an empty `apply` and owns no cross-plugin mutable
 * relation.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
