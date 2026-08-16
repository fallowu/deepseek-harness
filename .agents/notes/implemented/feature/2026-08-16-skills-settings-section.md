# Agent Note: Skills settings section in the skill UI plugin

Status: implemented

English | [中文](2026-08-16-skills-settings-section.zh.md)

## Problem

The settings panel had no view of the skill catalog. A user who wanted to know which skills a project offers — or whether a freshly authored skill was discovered — had to start a turn and read the injected available-skills reminder, or type "/" and read the menu. The catalog itself is per-project (the host resolves the session header's cwd), so any settings surface must answer "which project" before it can show anything.

## Decision

The Skills settings page lives in dsh-client-ui-skill, the skill domain's existing UI plugin, rather than a new package: the domain already owns the skill.list wire consumption, the skill locale namespace, and the web-app bundle row. The plugin's browser apply registers the shared settings.section slot (id skills, order 11, beside Models) and backs it with a small store (settings-store.ts) that reads the current session's project catalog through the same skill.list RPC the "/" slash source uses — one wire, two consumers, no new host surface.

The section renders one row per user-invocable skill (name, routing description), marks modelInvocable: false entries as user-only, offers a manual refresh, and carries explicit no-session, empty, and failure states. The store resolves the session from the sessions service's list snapshot; with no current session the page names the prerequisite instead of showing a wrong list, because the catalog is project-resolved.

## Alternatives considered

**A new client plugin package** — rejected. A settings page for skills owns no new service, wire, or composition row; a fresh package would add the three registration surfaces (tsconfig aggregate, bundle row, manifest dependency) for zero domain ownership. The existing skill plugin is the natural home.

**Grouping rows by discovery root (project/user/bundled)** — deferred. The wire's SkillEntry projection is deliberately consumer-neutral and carries no source or provider; grouping would require widening the host wire contract for one settings page. Revisit when a second consumer needs the breakdown.

**Inline enable/disable toggles per skill** — deferred. Skill availability is not a settings-document fact: the durable session catalog is host-computed from the preset composition, so a toggle would need a new persisted preference plus a host-side filter. That mechanism exists (the skill-filters fork proved the shape) but is a separate decision from viewing the catalog.

## Consequences

The settings panel gains a read-only Skills page whose content is exactly what "/" offers the composer — no divergence surface between the two views because they share one wire projection. Cost: the page shows the current session's project only, so a user inspecting another workspace's skills must switch sessions first; and rows carry no source/provider grouping (see alternatives). The plugin's dsh.client manifest and package peers gained dsh-client-ui-settings and dsh-client-web-react, which the section's slot registration and store binding require.

## Testing

pnpm vitest run packages/client/ui-skill/tests/browser-plugin.client.spec.ts covers the registration and the exact locale dictionaries (updated with the settings keys; 19/19). Live probe: the running web server serves the rebuilt ui-skill client bundle with the settings-section symbols present, and a page refresh shows the Skills settings page. Baseline check (git stash of this change): the four failures in ui-conversation/input-bar and ui-settings-models/styles specs predate this change and are unrelated.
