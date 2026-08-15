# 模型提供商配置笔记(contextWindow / maxTokens / 默认模型)

> 任务前置探索的结论存档(2026-08-15)。背景:此前派出的子代理全部失败,根因见下。

## 1. 各提供商能否设置上下文与输出大小

**能,两个适配器家族都支持,但配置位置不同:**

| 适配器 | 配置位置 | 字段 | 语义 |
|---|---|---|---|
| ``dsh-llm-deepseek`` | catalog 配置项 | ``contextWindow`` / ``maxTokens`` | per-model;不含上限的配置项回退适配器默认(输出上限默认 256,000) |
| ``dsh-llm-pi-ai`` | settings.yaml 的 ``llm-pi-ai.providers.&lt;route&gt;.models[]`` | ``contextWindow`` / ``maxTokens`` | per-model;**models 列表是替换不是扩充** —— 未列出的模型不可见;已列出但缺字段的条目从同 id 的已装 catalog 条目继承 |

pi-ai 0.82.1 内置 zai catalog(实测提取):glm-5-turbo / glm-5.1 = 200k ctx / 131072 out;**glm-5.2 = 1M ctx / 131072 out;没有 glm-5.3 条目**。

## 2. 本机已做的配置(`/.dsh/settings.yaml,不动仓库)

```yaml
llm-pi-ai:
  providers:
    zai-coding-cn:
      models:
        - id: glm-5.2
          contextWindow: 1000000
          maxTokens: 131072
        - id: glm-5.3          # ← 补齐:原缺 sizes(catalog 无此条目,无可继承)
          contextWindow: 1000000   # 镜像 glm-5.2 作为保守下限
          maxTokens: 131072
      apiKeyEnv: ZAI_CODING_CN_API_KEY   # 凭证已在 `/.dsh/.credentials.yaml
agent-default-model:
  provider: zai-coding-cn
  model: glm-5.3
```

**热重载已验证**:主会话的 ``request/context`` 从 262144(未知 sizes 时的回退)变为 1000000,无需重启。

**端到端已验证**:`pnpm dsh --profile headless 'Reply OK'` 新进程解析默认模型并真实请求成功,会话日志铁证:

```
request/header  config: {"provider":"zai-coding-cn","model":"glm-5.3","maxTokens":131072}
request/context zai-coding-cn glm-5.3 ctxWindow: 1000000
assistant/message "OK"
```

## 3. 子代理模型解析机制(此前失败的根因)

完整因果链(源码级):

1. 子代理选项由 ``resolveChildAgentOptions()`` 决定(packages/subagent/subagent/src/child-agent.ts):**继承父 agent 创建时的静态 ``AgentOptions``**,请求级覆盖 ``...requested`` 在后、优先。
2. GUI 会话内的模型切换走 ``installModelSelection()`` 的 **waterfall 覆盖**(packages/core/agent/src/model-selection.ts)—— 只改请求配置,**不回写 ``AgentOptions``**。
3. 当前会话的 agent 创建于用户在 GUI 选模型**之前**,其静态 options = 组合层默认 ``deepseek-official/deepseek-v4-flash``(无 key)→ 子代理继承它 → ``MISSING_CREDENTIAL``。

覆盖优先级(高→低):**工具 config 的 ``agentOptions`` &gt; 每次调用显式参数(模型面 schema 未暴露)&gt; 父 agent 静态 AgentOptions**。

### 修复路径

| 场景 | 状态 |
|---|---|
| 新进程 / 新会话 / 重启或 resume 后 | ✅ 已修复:入口点经 ``currentSelection()`` 读 settings,agent options = zai/glm-5.3,子代理继承之 |
| 当前 GUI 会话 | ✅ 已修复(2026-08-16 验证):页面刷新触发重连后 agent 重建,options 从 settings 默认物化为 zai/glm-5.3;子会话 ``request/header`` 与主进程逐字节一致(zai-coding-cn / glm-5.3 / maxTokens 131072),子代理回复含 reasoning 块。残留边界:会话内再切模型只走请求瀑布,不回写 options,子代理保持旧模型直至下次重建 —— 这是持久化/回放一致性的设计取舍 |
| 想强制某部署的所有子代理固定模型 | 在 preset 的 ``tool-subagent`` 行 config 加 ``agentOptions: {provider, model, maxTokens}``(优于继承)—— 用户自定义 preset 放 ``$DSH_HOME/.agent-presets/&lt;id&gt;/agent.cordis.yml``,不改仓库 |
| workflow 脚本内 | 脚本的 ``agent(prompt, {provider, model})`` 可逐 agent 指定 |

## 4. 排查方法存档

会话日志是 zstd 多 frame 拼接(macOS 无 zstd CLI、Node 22 无 node:zstd):按 magic ``28 B5 2F FD`` 切帧,每帧新开一个 ``zlib.createZstdDecompress()`` 流解码。``request/header`` 事件携带完整请求配置(含 ``adapterDefaults`` 标记哪些字段来自适配器默认)。
