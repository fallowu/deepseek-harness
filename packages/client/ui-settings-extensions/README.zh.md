# @deepseek-ai/dsh-client-ui-settings-extensions

[English](README.md) | 中文

自定义扩展面的设置页,浏览器半部:MCP 页(order 11)编辑 dsh-mcp-servers 协调器挂载的 mcp-servers section;技能页(order 12)编辑 dsh-skill-filesystem 实时应用的 skill-filters section。两页都通过 settings describe 读取,以观察到的 revision 经 settings mutate 写入整个 section 值(过期读取返回 settings-conflict),并通过在原始记录上打补丁而非重建,保持未知条目的全部字段不被丢弃。

## 模型体验

### 仅设置界面

#### 模型看到的内容

本插件不产生任何模型可见输入:它是设置界面。它改变哪些服务器挂载(`mcp-servers` section)与哪些技能名保持隐藏(`skill-filters` section),模型可见效果由那些归属包的 README 记载。自身不拥有 prompt section、工具或请求形状。

#### Token 影响

自身无;在此处做的编辑改变其配置面(已挂载服务器 schema、被隐藏技能名)的 token 成本。

#### KV Cache 影响

自身无;保存的编辑在其配置面的下一个请求使其前缀失效,而非本页。

## Known Limitations and Deferred Work

- MCP 页仅编辑传输身份字段(command/args/url);超时、headers、env 与水面开关保留存储值,但暂无编辑字段。
- 技能页整 section 写入;来自其他标签页的并发编辑表现为 settings-conflict,需重开页面。
