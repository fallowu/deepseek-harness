# Agent Note: 技能设置页放在技能 UI 插件内

Status: implemented

[English](2026-08-16-skills-settings-section.md) | 中文

## Problem

设置面板没有技能目录的视图。用户想知道一个项目提供哪些技能——或新写的技能是否被发现——只能发起一轮对话读注入的 available-skills 提醒,或输入 "/" 看菜单。目录本身按项目解析(宿主读会话头的 cwd),因此任何设置面必须先回答"哪个项目"才能展示内容。

## Decision

技能设置页放在 dsh-client-ui-skill(技能域既有的 UI 插件)而不是新包:该域已经拥有 skill.list wire 消费、skill locale 命名空间和 web-app bundle 行。插件的浏览器 apply 注册共享的 settings.section 插槽(id skills,order 11,与模型页相邻),并由一个小 store(settings-store.ts)支撑:读取当前会话的项目目录,走与 "/" 斜杠源相同的 skill.list RPC —— 一条 wire,两个消费者,不新增宿主面。

该页每个可用户调用的技能渲染一行(名称、路由描述),modelInvocable: false 的条目标记"仅用户调用",提供手动刷新,并有明确的 无会话 / 空目录 / 失败 三种状态。store 从 sessions 服务的列表快照解析会话;无当前会话时页面说明前置条件而不是给出错误列表,因为目录按项目解析。

## Alternatives considered

**新建客户端插件包** —— 弃用。技能的设置页不拥有新服务、wire 或组合行;新包要为零域名所有权付出三处注册面(tsconfig 聚合、bundle 行、manifest 依赖)。既有技能插件是天然归属。

**按发现根分组(项目/用户/内置)** —— 暂缓。wire 的 SkillEntry 投影刻意保持消费者中立,不携带 source 或 provider;分组需要为一个设置页加宽宿主 wire 契约。等第二个消费者需要该拆分再做。

**每个技能行内启停开关** —— 暂缓。技能可用性不是设置文档事实:持久会话目录由 preset 组合在宿主侧计算,开关需要新的持久偏好加宿主侧过滤。该机制已被验证可行(skill-filters 分叉证明了形状),但与"查看目录"是两个决策。

## Consequences

设置面板获得一个只读技能页,内容与 "/" 提供给输入框的完全一致 —— 两个视图共享同一 wire 投影,不存在分歧面。代价:该页只显示当前会话的项目,查看其他工作区的技能须先切换会话;行不携带来源分组(见 alternatives)。插件的 dsh.client manifest 与 package peers 增加了 dsh-client-ui-settings 和 dsh-client-web-react,这是插槽注册与 store 绑定所需的。

## Testing

pnpm vitest run packages/client/ui-skill/tests/browser-plugin.client.spec.ts 覆盖注册与精确 locale 字典(已随 settings 键更新;19/19)。在线探活:运行中的 web 服务器分发包含 settings-section 符号的重建 ui-skill client bundle,刷新页面可见技能设置页。基线核查(对本变更 git stash):ui-conversation/input-bar 与 ui-settings-models/styles 各自的四个失败早于本变更,与本变更无关。
