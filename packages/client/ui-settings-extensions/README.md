# @deepseek-ai/dsh-client-ui-settings-extensions

English | [中文](README.zh.md)

Settings pages for the custom extension surfaces, browser half: the MCP page (order 11) edits the mcp-servers section the dsh-mcp-servers reconciler mounts, and the Skills page (order 12) edits the skill-filters section dsh-skill-filesystem applies live. Both pages read through settings describe, write whole-section values through settings mutate with the observed revision (settings-conflict on a stale read), and keep every field of unknown entries intact by patching over the raw record rather than rebuilding it.

## Model Experience

### Settings-surface only

#### What the model sees

Nothing from this plugin: it is a settings surface. It changes which servers mount (`mcp-servers` section) and which skill names stay hidden (`skill-filters` section), and those owners' READMEs own the model-visible effects. No prompt section, tool, or request shape of its own.

#### Token effect

None directly; edits made here change the token cost of the surfaces they configure (mounted server schemas, hidden skill names).

#### KV Cache effect

None directly; a saved edit invalidates the configured surface's prefix at its next request, not this page's.

## Known Limitations and Deferred Work

- The MCP page edits transport identity fields (command/args/url) only; timeouts, headers, env, and the surface switches keep their stored values but have no editor field yet.
- The Skills page writes the section as a whole; concurrent edits from another tab surface as settings-conflict and require reopening the page.
