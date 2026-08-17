/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-mcp-servers`.
 * @module @deepseek-ai/dsh-mcp-servers/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-mcp-servers'

/** Cordis companion plugin name. */
export const name = 'mcp-servers-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the fleet reconciler owns one settings-sourced
 * relation (mounted child fibers ↔ mcp-servers section entries) and enforces
 * it directly — a publish reconciles every entry and disposal drops the
 * matching fiber — with no cordis event stream or cross-plugin mutable
 * relation left for a companion to check.
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
