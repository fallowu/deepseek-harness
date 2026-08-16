# dsh-custom-skill-filesystem

``@deepseek-ai/dsh-skill-filesystem`` 的自定义分叉:增加两个过滤配置,控制"不扫其他 agent 的全部 skills"(遵循 custom/ 约定,零修改原项目)。

## 新增配置

| 字段 | 语义 |
|---|---|
| ``includeSources`` | 发现源白名单;缺省 = 全部(上游行为)。可选值:``project-dsh``(.dsh/skills)、``project-agents``(.agents/skills)、``custom``、``user-dsh``(`/.dsh/skills)、``user-agents``(`/.agents/skills)、``bundled`` |
| ``excludeNames`` | kebab 名单,支持 ``prefix-*`` 前缀 glob;``['okx-*']`` 隐藏整族外部技能,不动文件 |

两层过滤:root 级(source 不在白名单 → 整棵目录树不扫)→ 候选级(名字命中排除表 → 从目录剔除)。``includeSources`` 为空数组或缺省不过滤。

## 端到端验证(2026-08-16)

headless + patch(disable 原行 + insert 分叉行),``includeSources: [project-dsh, project-agents, user-dsh]`` + ``excludeNames: ['okx-*']``:

- 过滤前:catalog 含 okx 家族(user-agents 来源)
- 过滤后:``count=10, okx=no`` — in-repo dsh-* 技能保留,okx 全隐藏 ✅
- 反例校准:白名单漏掉 ``project-agents`` 时 count=0(仓库技能全在 .agents/skills),证明 root 级过滤真实生效

## 挂载

- **headless / 无 preset 环境**:patch ``disable`` 原 ``skill-filesystem`` 行 + ``insert`` 分叉行
- **Web GUI**:用户 preset ```/.dsh/.agent-presets/filtered/``(复制 standard,skill-filesystem 行换本包 + 过滤 config),GUI 会话选 ``filtered`` preset

```sh
cd custom/skill-filesystem && ../../node_modules/.bin/tsdown   # lib/index.js 31KB
dsh plugin --profile web add ./custom/skill-filesystem
dsh plugin --profile headless add ./custom/skill-filesystem
```

## Model Experience

只改变 catalog 的候选集合(哪些技能被列出/可加载);``<available_skills>`` 注入机制、skill 工具形状、session 事件均不变。过滤后 catalog 变小 = 每请求注入文本变短。

## Known Limitations and Deferred Work

- ``excludeNames`` 只支持前缀 glob(``prefix-*``),不支持中缀/后缀通配(无当前需求)
- 过滤是组合层配置,暂无 GUI 编辑面(backlog:技能管理页)
- 上游 skill-filesystem 演进需手工同步本分叉
