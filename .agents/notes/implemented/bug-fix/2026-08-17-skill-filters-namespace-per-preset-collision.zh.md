# Agent Note：skill-filters 设置命名空间兼容多预设挂载

状态：已实现

[English](2026-08-17-skill-filters-namespace-per-preset-collision.md) | 中文

## 问题

恢复任何与已挂载预设不同的会话都会失败，报 `preset "code" failed to mount: ... settings namespace "skill-filters" is already registered`。预设组合（`standard`、`code` 等）各自在常驻 scope 下挂载一份 `dsh-skill-filesystem` 实例，而 custom fork 合并让每份实例的 `apply` 都调用 `ctx.settings.register(SKILL_FILTERS_SETTINGS_NAMESPACE, …)`。settings 服务对命名空间做进程级唯一校验，因此第二个预设挂载必然抛错。合并还使两个 `skill-filesystem` 测试文件完全没有挂载 settings 服务，`inject: ['settings']` 让插件一直等待，套件 21 个测试中 20 个失败。

## 决策

命名空间归属改为「一个部署级配置段，首个注册者拥有，后续实例挂靠」：

- `dsh-settings` 新增 `has(ns)` 与 `watch(ns, cb)`——非属主观察路径。`watch` 把回调加入与属主 `SettingsScope.watch` 相同的按注册 watcher 集合（共用 `attachWatcher` 辅助），继承提交顺序串行化、失败遏制与 disposer 门控启动；命名空间未注册时抛错。
- `dsh-skill-filesystem` 仅在 `has` 报告不存在时注册命名空间，此后所有实例经 `ctx.settings.get(ns)` 读取、经 effect 作用域的 `ctx.settings.watch(ns, …)` 观察。预设行以无配置方式挂载本插件，因此属主实例的 `base`（全部来源、无排除）即为权威基准；已写入包 README。

把该行上提到宿主组合的方案被否决：skills 注册表按预设 scope 分层，正是为了让预设决定其 agent 是否获得技能（`minimal` 预设一个也不挂），而预设 realm 标签无法跨常驻 scope 池化一个共享实例（同一 realm 下第二次 `provide()` 会抛错）。

## 后果

两个挂载的预设现在共享一个实时的 `skill-filters` 段；设置页的一次编辑通过一次发布驱动所有提供方实例。挂靠路径假定常驻挂载与进程同寿命：若属主预设的 scope 被销毁而另一实例仍在，命名空间随之注销，挂靠的读取方保持最后应用的过滤器直到新属主注册——可接受，因为预设常驻 scope 每进程挂载一次，仅在关机或显式 recompose 时销毁。

## 测试

- `packages/skill/skill-filesystem/tests/skill-filesystem.spec.ts`：所有测试挂具现在都挂载内存版 `SettingsProvider`；回归测试在同一 settings 服务上挂载两个实例（不同 provider 名），断言无冲突，并断言一次 `settings.update` 驱动两者。
- `packages/settings/settings/tests/settings.spec.ts`：`watch` 以 next/prev 载荷观察已注册命名空间并在 disposer 后停止；`has` 随注册翻转；对未注册命名空间 `watch` 抛错。
