# @deepseek-ai/dsh-mcp-servers

[English](README.md) | 中文

设置驱动的 MCP 服务器组:一个插件条目读取 mcp-servers 设置 section(以 serverName 为键的字典,每个值是一台服务器的传输配置),并通过 @deepseek-ai/dsh-mcp-client 单服务器桥为每个条目保持一个子 fiber。每次设置发布时,协调器将已挂载的一代与文档比对:新名字挂载、变更条目替换(先释放再挂载)、消失的名字释放 —— 无需重启宿主。每服务器的水面开关(resources、prompts)与传输字段原样传给单服务器配置。

挂载行:name '@deepseek-ai/dsh-mcp-servers';依赖 settings 服务。模型风格的管理页(dsh-client-ui-settings-extensions)通过设置 wire 编辑同一 section。

## 模型体验

### 挂载的服务器组工具

#### 模型看到的内容

间接影响:本插件改变目录中存在哪些 `mcp__<server>__*` 工具。每台已配置服务器贡献其工具,并在启用时加上四个水面工具(`list_resources`、`read_resource`、`list_prompts`、`get_prompt`);从设置移除的服务器在下一轮装配时注销其整代工具。自身不改变 prompt section 或请求形状。

#### Token 影响

间接且依赖数据:每台已挂载服务器的工具 schema 随每个请求发送;从设置移除服务器后,下一次装配起不再携带其 schema。

#### KV Cache 影响

间接:挂载或替换服务器改变工具 schema 块,在变更后的第一个请求使请求前缀失效一次;稳态下缓存稳定。

## Known Limitations and Deferred Work

- 协调器按条目的浅层 JSON 比对做差分;语义等价但默认值形状不同的编辑仍会替换 fiber(断开重连)。
- 被替换条目的服务器侧失败经单服务器桥自身的日志呈现;设置页显示文档,不显示实时连接状态。
