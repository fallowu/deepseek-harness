# dsh-custom-ui-conversation

``@deepseek-ai/dsh-client-ui-conversation`` 的自定义分叉:在输入框 + 按钮旁增加**可见的附件(回形针)按钮** + 隐藏 file input,让图片上传不再只藏在粘贴/拖拽两个隐藏手势里(遵循 custom/ 约定,零修改原项目)。

## 改动点(相对上游)

- ``InputBar.tsx``:+ 按钮旁新增回形针按钮(hidden ``input[type=file][multiple]``,``accept`` 跟随 ``imageLimits.mediaTypes``),选中即走原 ``intakeImages``(限额预检/错误提示/缩略图轨全复用)
- ``locales.ts``:新增 ``input.attach`` 键(中:上传图片 / 英:Upload images)
- 其余 91 个源文件原样复制

## 背景结论(2026-08-16 探索)

- **wire/后端已完整支持图片**:``PromptContentPart = text | {type:image, mediaType, base64, name}``;apiproxy 有校验/存储/限额/引用完整链路;原 InputBar 已有粘贴/拖拽/缩略图轨/灯箱
- 缺口 1(本包修复):无可见入口 —— 加号按钮只开 command menu,没有文件选择器
- 缺口 2(未修,产品级):**仅图片**(PNG/JPG/WebP/GIF);任意文件附件需要 wire 类型 + ``AttachmentStore``(现只有 ``saveImage``)+ 模型可见策略三层扩展 → 已列 backlog

## 构建与挂载

```sh
cd custom/ui-conversation && ../../node_modules/.bin/tsdown   # lib/client.js 433KB
dsh plugin --profile web add ./custom/ui-conversation
```

web profile patch:``disable`` 原 ``ui-conversation`` 行 + ``insert`` ``ui-conversation-custom`` 行(已配置于 ``/Users/mic/.dsh/profiles/web/cordis.patch.yml``)。

验证:``/plugins/dsh-custom-ui-conversation/client.js → 200(433KB,含 7 处附件代码)``,原包 404;刷新页面生效。

## Model Experience

不改变模型可见输入类型:按钮只是 ``paste/drop`` 之外的第三个入口,产出与既有手势完全相同的 image part;限额预检逻辑原样复用。

## Known Limitations and Deferred Work

- 仅图片;任意文件附件见 backlog 新项(需 wire + 存储缝 + 模型呈现三层设计)
- 整包 fork(91 文件),上游演进需手工同步;上游自身将来若加可见入口,本分叉即可退役
- ``clsx`` 经 ``node_modules`` 软链解析(pnpm store),与 ui-settings-models 同模式
