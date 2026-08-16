# dsh-custom-mcp-servers / dsh-custom-ui-settings-extensions / 文件附件

本轮三项交付的使用说明(构建/挂载细节见各包 README)。

## 1. 文件附件(custom/ui-conversation v2,已热生效)

- **入口**:回形针按钮(选择文件)、拖拽到页面任意处、粘贴(Finder 复制文件后 Cmd+V)
- **图片**(PNG/JPG/WebP/GIF):原二进制通道(视觉输入)
- **PDF**:浏览器内 pdf.js 提取全文(分页标注,≤200 页/400K 字符/20MB),以文本块随消息发送
- **文本类**(.txt/.md/.json/.csv/.log/.xml/.yaml/.js/.ts 等):直接读取为文本
- 文件 chip 显示在缩略图轨下方,可单独移除;仅文件无文字也可发送(Enter 直发)
- 零后端改动:文档以 `[attached file: name, N pages]` 文本块进入模型上下文

## 2. MCP 管理页(重启 web host 后生效)

设置页新增 **MCP** 区(order 11):每服务器一行(名称 + stdio 命令/参数 或 http URL),增删改后 Apply。

数据落 `settings.yaml` 的 `mcp-servers:` section;`custom/mcp-servers`(fleet reconciler,register+watch)按文档实时挂载/替换/断开各服务器(内嵌 custom/mcp-client 单服务器桥,含 Resources/Prompts 面)。

端到端已验证:settings 文档写入 mini server → 模型调用 `mcp__mini__list_resources`/`read_resource` → 笔记内容原样返回。

## 3. Skill 管理页(重启 web host 后生效)

设置页新增 **技能** 区(order 12):
- 六个发现源勾选(project-dsh/project-agents/custom/user-dsh/user-agents/bundled)
- 排除名单(每行一条,支持 `prefix-*`)

数据落 `settings.yaml` 的 `skill-filters:` section;`custom/skill-filesystem` register+watch 实时应用(当前已配置 `excludeNames: [okx-*]`,经验证 count=9 精确过滤)。

> web profile patch 已将默认 preset 指向 `filtered`(custom skill provider);新 GUI 会话自动使用。

## 已知边界

- 运行中的 web host **不热加载新增插件行** —— 两个管理页与 fleet 需重启 `dsh web` 后出现(会话数据无损,事件溯源)
- `--patch` 插件名不支持子路径 export(loader 静默不加载)—— fleet 因此独立成包并将 single 源码 tsdown 内联
- settings section 的文档值可能在插件注册后才发布 —— 必须用 `ctx.settings.register + scope.watch`(installSettingsSection 的 setSource 只装一次 getter,晚到的值不会重放;已两次踩中)
