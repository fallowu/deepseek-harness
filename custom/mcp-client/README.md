# dsh-custom-mcp-client

`@deepseek-ai/dsh-mcp-client` 的自定义分叉,补齐 MCP Resources 与 Prompts 两个原语(遵循 custom/ 约定,零修改原项目)。

## 新增能力

在原 tools 桥(重连/命名/HMR 语义不变)之上,按服务器握手 capabilities 注册四个静态工具:

| 工具 | 协议方法 | 说明 |
|---|---|---|
| `mcp__<server>__list_resources` | `resources/list` | 聚合分页,列出 uri/name/mimeType/description |
| `mcp__<server>__read_resource` | `resources/read` | 按 uri 读取;文本原样,二进制为占位摘要 |
| `mcp__<server>__list_prompts` | `prompts/list` | 列出模板与参数签名(required/描述) |
| `mcp__<server>__get_prompt` | `prompts/get` | 带参渲染,消息逐条转文本 |

- 能力门控:服务器不广播 `resources`/`prompts` capability 就不注册对应面
- 生命周期与 tools 桥同一两阶段纪律(先构建后交换),断线/放弃时一并注销
- 命名复用 `publicToolName`(归一化 + 哈希防碰撞)
- 配置开关:`resources: false` / `prompts: false` 可单面关闭(默认全开)

## 端到端验证(2026-08-16)

stdio mini server(echo 工具 + notes 资源 + review 提示模板),headless 真实模型调用:

- resources 面:list → read → `- shipped surfaces bridge` 原样返回 ✅
- prompts 面:get(topic=the surfaces bridge)→ `Please review the change about the surfaces bridge and list risks.` 原样返回 ✅

## 构建与挂载

~~~sh
cd custom/mcp-client && ../../node_modules/.bin/tsdown   # lib/index.js 35KB(peers 外部化)

dsh plugin --profile web add ./custom/mcp-client
dsh plugin --profile headless add ./custom/mcp-client
~~~

示例行(--patch 或 profile patch):

~~~yaml
- insert:
    - id: mcp-mini
      name: dsh-custom-mcp-client
      config:
        transport: stdio
        serverName: mini
        command: node
        args: ['/path/to/server.mjs']
~~~

## Model Experience

四个新工具进入工具目录(每服务器 +4 schema,不可用时为 0);工具结果为纯文本内容块,不新增模型可见输入类型,不新增 session 事件。

## Known Limitations and Deferred Work

- Resources 订阅(`resources/subscribe` 变更通知)未桥接;当前按需 list/read
- Prompts 只以模型工具面暴露;`ctx.commands` 人类斜杠命令桥留待(需要参数 UI 约定)
- MCP sampling / elicitation(服务器反向请求)仍未覆盖,与原版一致
