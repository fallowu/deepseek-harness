# @deepseek-ai/dsh-mcp-servers

English | [中文](README.zh.md)

Settings-driven MCP server fleet: one plugin entry that reads the mcp-servers settings section (a dict keyed by serverName, each value a single-server transport config) and keeps one child fiber per entry mounted through the @deepseek-ai/dsh-mcp-client single-server bridge. The reconciler compares the mounted generation with the document on every settings publish: new names mount, changed entries replace (dispose then mount), vanished names dispose — no host restart. Per-server surface switches (resources, prompts) and transport fields pass through to the single-server config verbatim.

Mount row: name '@deepseek-ai/dsh-mcp-servers'; requires the settings service. The Models-style settings page (dsh-client-ui-settings-extensions) edits the same section over the settings wire.

## Model Experience

### Mounted fleet tools

#### What the model sees

Indirect: this plugin changes which `mcp__<server>__*` tools exist in the catalog. Each configured server contributes its tools plus, when enabled, the four surface tools (`list_resources`, `read_resource`, `list_prompts`, `get_prompt`); a server removed from settings unregisters its whole generation on the next turn's assembly. No prompt-section or request-shape change of its own.

#### Token effect

Indirect and data-dependent: every mounted server's tool schemas ride each request while mounted; removing a server from settings removes its schemas from the next assembly onward. Each mounted server also contributes its surface tools' schemas (`list_resources`, `read_resource`, `list_prompts`, `get_prompt`) when enabled.

#### KV Cache effect

Indirect: mounting or replacing a server changes the tool-schema block and invalidates the request prefix once, at the first request after the change; steady state is cache-stable.

## Known Limitations and Deferred Work

- The reconciler diffs by shallow JSON comparison of each entry; a semantically identical edit that reshapes defaults still replaces the fiber (disconnect + reconnect).
- Server-side failures of a replaced entry surface through the single-server bridge's own logging; the settings page shows the document, not live connection state.
