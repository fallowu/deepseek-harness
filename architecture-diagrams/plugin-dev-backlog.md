# DSH Plugin 开发项清单(Backlog v2)

> 承接架构分析(见同目录 ``architecture.md``)与主流智能体对照得出的缺口。

## 开发要求(硬性)

1. **一切皆插件**:所有功能严格按项目 everything is plugin 思想实现 —— 新行为只挂文档化扩展点(``ctx.effect``/``ctx.on``/waterfall/能力缝三角色),**不改 agent-loop、不改 ``packages/`` 下任何现有包**。
2. **custom/ 隔离**:新开发的 plugin 一律放 ``custom/`` 文件夹,以 out-of-tree 插件 + 独立 profile 的方式组合挂载,**不直接覆盖项目**(不改 shipped bundles 的 ``cordis.patch.yml``,不往 ``packages/`` 添加行)。

---

## 0. custom/ 目录与挂载机制("不覆盖项目"的具体实现)

DSH 原生支持这条路(见 ``docs/user/develop/basic/publish.md``):profile 持有 out-of-tree 插件,``dsh plugin`` 命令负责安装与登记。

### 目录约定

```
custom/
├── README.md                本约定(挂载机制、规则)
├── cost-cap/                每个开发项一个插件包
├── memory/
├── browser/
├── …
```

每个 ``custom/&lt;name&gt;/`` 是标准插件包:``package.json``(声明 ``"dsh": {"bundle": {"patch": "./cordis.patch.yml"}}``)+ ``cordis.patch.yml``(自己的 insert 行)+ ``src/`` + ``tests/`` + ``README.md`` + ``invariant.ts``。

### 挂载工作流

```sh
# 1. 初始化 custom profile 并链接插件包(dsh 自动:pnpm link + 追加 dsh.profile.bundles)
dsh plugin --profile custom add ./custom/cost-cap

# 2. 不 boot 先验证组合层
dsh --profile custom --dump-config     # 应看到 "# == cost-cap" 层

# 3. 运行
dsh --profile custom

# 4. 卸载(依赖与层一起移除)
dsh plugin --profile custom remove cost-cap
```

### 加载顺序与覆盖规则

```
空 entry 列表
 → ① @deepseek-ai/dsh-base(in-box,永远从安装解析)
 → ② custom bundles(dsh.profile.bundles 顺序)
 → ③ profile 自己的 cordis.patch.yml
 → ④ $DSH_HOME/cordis.patch.yml(home 级)
 → ⑤ --patch overlay
```

- 后层按行 id 覆盖前层,**整行替换不合并** —— 需要改 dsh-base 某行的行为时,在自己的 patch 里按 id 重声明整行(这是合法组合,不是修改项目);
- in-box 插件名通过 ``$DSH_HOME/profiles/node_modules`` 平铺 fallback 保持可解析;custom 包对 ``@deepseek-ai/dsh-*`` 的依赖由 profile 的 pnpm link 解决;
- 每个 custom 插件**可独立移除**,移除后组合回到纯 dsh-base + 其余层 —— 验证"没有特权核心"的活证据。

---

## 1. 通用开发约定(每一项都适用)

| 约定 | 要求 |
|---|---|
| 命名与布局 | ``custom/&lt;name&gt;/``,npm 名 ``dsh-custom-&lt;name&gt;``(或保持私有不发布);``src/types.ts`` 只有类型;测试在包级 ``tests/`` |
| 插件导出形式 | service 包 default-export service 类;函数插件 named-export ``name/inject/Config/apply``,两者不混 |
| 注册即效果 | 一切贡献走 ``ctx.effect()``/``ctx.on()``;``register()`` 返回 disposer;HMR 安全测试:dispose 后观察移除 |
| 能力缝完整度 | Definition / Provider / Consumer 三角色齐全;custom 插件依赖 Service Definition,永不依赖具体 Provider |
| Model-visible ⟺ logged | 新的模型可见输入需要新 session 事件;若走"持久状态确定性投影"路线,在 Agent Note 里明确这个设计决策 |
| 无硬编码 tunables | 部署可变的值是验证过的 ``Config`` 字段,可从 patch 层改 |
| 零内核改动 | 不改 ``packages/``、不改 agent-loop、不改 shipped bundles;只新增 custom 包 + patch 层 |
| 测试 | REAL-composition 测试:经 ``dsh --profile custom``(或 Loader 起等价 cordis.yml);模型/用户可见行为加 keyless snapshot |
| 不变量 | 每包 ``./invariant``:注册 manifest 名,检查事件/数据关系 |
| 文档 | README 含 Model Experience 与 ``## Known Limitations and Deferred Work``;非平凡变更附 Agent Note |

---

## 2. P0 —— ``custom/tui`` 终端交互面

**问题**:有 web GUI / headless / ACP / JSON-RPC SDK 四个入口,缺 Claude Code 式富终端交互面;slash 命令(``ctx.commands``)只在 web 里可达。

**架构落点**:新 surface **custom bundle**(组合 dsh-base + sdk server + tui renderer);交互走 ``packages/sdk/`` JSON-RPC 客户端,TUI 是纯 Consumer;渲染订阅 ``session/event`` 投影;slash 命令直接调 ``ctx.commands`` 分发。不新增模型可见输入 → 无新 session 事件。

**包布局**:``custom/tui/``(renderer + 输入循环,ink)。挂载:``dsh plugin --profile custom add ./custom/tui`` 后 ``dsh --profile custom`` 进入终端面。

**验收**:
- [ ] REAL:``--profile custom`` 起终端,脚本化输入驱动一个完整 turn;
- [ ] snapshot:transcript 输出(含工具调用渲染);
- [ ] slash 命令(/compact /goal /plan)不经模型;审批 ask 流在终端可答;
- [ ] 移除 ``custom/tui`` 后 ``--profile custom`` 仍可跑 headless(无残留依赖)。

**规模**:M。

---

## 3. P0.5 —— ``custom/browser`` 能力缝(browser-use)

**问题**:``web/`` 缝只有 search/fetch;没有"看屏幕 → 操作"的执行面。多模态输入侧已具备。

**三角色**(一个 custom 包内三个子路径,或拆多包):
```
Service Definition  custom/browser           ctx.browsers + resolve(request): Spec
Service Provider    custom/browser-playwright(可换 browser-remote / E2B)
Consumer            custom/tool-browser      navigate / click / type / screenshot / read_page
```

**架构落点**:浏览器进程经 ``ctx.subprocess``/``ctx.sandbox`` 包装 spawn(与 shell 家族同构,天然三档沙箱);能力事件 ``browser/*``(域名白名单、导航审批);截图 → ``attachment/`` 内容寻址 → 视觉消息;引用随 ``tool/result`` 落日志。

**patch 行(在自己的 ``cordis.patch.yml`` 里,不动 base)**:
```yaml
- insert:
    - id: browser
      name: dsh-custom-browser
    - id: browser-playwright
      name: dsh-custom-browser/playwright
    - id: tool-browser
      name: dsh-custom-browser/tool
      config:
        allowedOrigins: ['localhost']
```

**验收**:本地静态页 导航→点击→截图→断言 REAL 测试;越域导航被 ``browser/*`` 审批拦截且错误落日志;mock provider 走同一 Spec 接口。

**规模**:L。**依赖**:Playwright(maintained dep)。

---

## 4. P1 —— ``custom/memory`` 能力缝(跨会话长期记忆)

**三角色**:
```
Service Definition  custom/memory       ctx.memory:读/写/检索记忆条目
Service Provider    memory-file         $DSH_HOME 下 JSONL(后续可加 sqlite provider)
Consumer ①          memory-distill      监听 session/event,turn 边界蒸馏事实
Consumer ②          memory-section      system-prompt section,会话开启时注入
```

**架构落点**:事件溯源日志为蒸馏源;注入走 system-prompt section(model-visible 决策:持久存储确定性投影,写 Agent Note);默认 **opt-out**(不加入 profile 不生效),``/memory clear`` 走 ``ctx.commands``。

**验收**:会话 A 蒸馏 → 新会话 B 的 section 含该事实(snapshot);清除后消失;蒸馏写入与投影一致性 invariant。

**规模**:M。

---

## 5. P1 —— ``custom/daemon`` 常驻调度器

**架构落点**:custom surface bundle:常驻进程 + 持久任务队列(``storage/``);到期任务以 headless 语义组合运行,每任务独立 session;通知走 webhook Consumer;查询走 ``ctx.commands``;远程执行可指向 E2B。

**验收**:入队→触发→运行→通知 REAL 链路(假时钟);daemon 崩溃重启队列不丢、不重跑;任务报告 snapshot。

**规模**:M-L。

---

## 6. P1 —— ``custom/cost-cap`` 成本硬帽

**架构落点**:``agent/request`` waterfall 策略监听器:读 token-meter 累计,超预算短路拒绝(单决策事件 short-circuit 是设计语义);拒绝以 request-error 留痕;``maxSessionTokens/maxDailyTokens/hardStop|warn`` 全是 Config 字段。

**包布局**:``custom/cost-cap/``。

**验收**:小预算下第二个请求被拒、turn 正常关闭、日志含原因;warn 档只注记;移除插件后行为完全消失。

**规模**:S —— **建议第一个做**(练手验证整套 custom 流程)。

---

## 7. P2 —— worktree 并行隔离 / 多用户平面 / eval 运行器

同样以 custom 插件形态实现,设计要点不变:

- **worktree 隔离**:``custom/workspace-worktree``:workspace 派生 worktree;``sandbox-policy.workspaceRoot`` 在自己的 patch 层按 id 整行重声明指向 worktree;subagent provider 加 ``workspace: isolate`` 配置。
- **多用户/团队平面**:``custom/host-auth``:host 侧 auth 中间件 + 会话 ACL(挂 ``session/*`` 投影);共享链接 = 只读投影消费者;需独立威胁模型 Agent Note;最后做。
- **eval 运行器**:``custom/eval-runner``:复用 ``test:snapshot`` 基建 + headless 批量运行 + LLM 裁判评分 + 报告落 ``storage/``;独立 profile 入口。

---

## 8. 刻意不做 / 延后

| 项 | 立场 |
|---|---|
| 代码库 embedding 索引 | agentic grep + LSP 优先;超大 monorepo 用户可日后自补 custom 能力缝 |
| 记忆语义检索 | ``custom/memory`` 先做文件投影;语义检索等真实需求再上 sqlite provider |
| 语音/图像生成输出 | 自动化 harness scope 之外 |

---

## 汇总

| 顺序 | 包 | 优先级 | 规模 | 新 session 事件 | 挂载方式 |
|---|---|---|---|---|---|
| 1 | ``custom/cost-cap`` | P1 | **S** | 否 | patch insert 单行 |
| 2 | ``custom/tui`` | P0 | M | 否 | surface bundle |
| 3 | ``custom/memory`` | P1 | M | 否(持久投影) | patch insert 三行 |
| 4 | ``custom/browser`` | P0.5 | L | 否(attachment 引用) | 能力缝三行 |
| 5 | ``custom/daemon`` | P1 | M-L | 否 | surface bundle |
| 6+ | worktree / eval / host-auth | P2 | M-L | 待设计 | 各自 insert |

**路线**:``cost-cap(一天级,先跑通 custom 全流程)→ tui(补最大入口缺口)→ memory(地基优势变现)→ browser(新执行世界)→ daemon → P2``。

每一项都验证同一信条:新行为挂文档化扩展点、三角色齐全、注册即效果、model-visible ⟺ logged —— 并且移除任何一个 custom 包,组合都干净回到 dsh-base。
