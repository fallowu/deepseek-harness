# Agent Note: skill-filters settings namespace survives multiple preset mounts

Status: implemented

English | [中文](2026-08-17-skill-filters-namespace-per-preset-collision.zh.md)

## Problem

Resuming any session whose preset differs from the already-mounted one failed with `preset "code" failed to mount: ... settings namespace "skill-filters" is already registered`. Preset compositions (`standard`, `code`, …) each mount their own `dsh-skill-filesystem` instance under their standing scope, and the custom-fork merge had made every instance's `apply` call `ctx.settings.register(SKILL_FILTERS_SETTINGS_NAMESPACE, …)`. The settings service enforces namespace uniqueness per process, so the second preset's mount always threw. The merge had also left both `skill-filesystem` spec files mounting no settings provider at all, so `inject: ['settings']` kept the plugin pending and 20 of 21 suite tests failed.

## Decision

Namespace ownership now follows "one deployment-level section, first registrant owns, later instances attach":

- `dsh-settings` gained `has(ns)` and `watch(ns, cb)` — the non-owner observe path. `watch` adds its callback to the same per-registration watcher set as the owner's `SettingsScope.watch` (shared `attachWatcher` helper), inheriting the commit-order serialization, contained failures, and disposer-gated start; it throws while the namespace is unregistered.
- `dsh-skill-filesystem` registers the namespace only when `has` reports it absent, then every instance reads through `ctx.settings.get(ns)` and observes through an effect-scoped `ctx.settings.watch(ns, …)`. Preset rows mount the plugin config-less, so the owning instance's `base` (every source, no exclusions) is authoritative; documented in the package README.

Hoisting the row to the host composition was rejected: the skills registry is layered per preset scope precisely so a preset chooses whether its agents get skills (the `minimal` preset mounts none), and preset realm labels cannot pool one shared instance across standing scopes (`provide()` throws on the second registration).

## Consequences

Two mounted presets now share one live `skill-filters` section; a settings-page edit drives every provider instance through one publish. The attach path assumes standing mounts are process-lifetime: if the owning preset's scope is disposed while another instance still lives, the namespace drops with it and attached readers keep their last-applied filters until a new owner registers — acceptable because preset standing scopes are mounted once per process and disposed only at shutdown or explicit recomposition.

## Testing

- `packages/skill/skill-filesystem/tests/skill-filesystem.spec.ts`: every harness now mounts an in-memory `SettingsProvider`; a regression test mounts two instances (distinct provider names) over one settings service, asserts no collision, and asserts one `settings.update` drives both.
- `packages/settings/settings/tests/settings.spec.ts`: `watch` observes a registered namespace with next/prev payloads and stops after its disposer; `has` flips around registration; `watch` on an unregistered namespace throws.
