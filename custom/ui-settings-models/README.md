# dsh-custom-ui-settings-models

`@deepseek-ai/dsh-client-ui-settings-models` 的自定义分叉(out-of-tree 插件,遵循 custom/ 约定,不修改 packages/)。

## 增加的能力

pi-ai 自定义提供方的模型行,在"容量"展开区新增 **思考参数** 编辑,与上下文/输出并列:

- **继承目录能力**(默认):不写 `reasoningEfforts`,沿用已装 catalog 条目的思考级别;
- **不支持思考**:写 `reasoningEfforts: false`,从目录模型上剥离推理;
- **自定义思考级别**:为 off / minimal / low / medium / high / xhigh / max 逐级勾选,并填写每个级别的 **下发值**(wire spelling,发送给提供方的字符串;`off` 可留空 = 提供该级别且不发送)。

写入 `settings.yaml` 的 `llm-pi-ai.providers.<route>.models[].reasoningEfforts`,由 `dsh-llm-pi-ai` 的解析器翻译为 pi-ai 的 `thinkingLevelMap`;被声明了思考级别的模型随后在模型选择器中出现 effort 选项 —— 与 DeepSeek 官方模型的体验一致。

行内即时校验:自定义级别为空集、或非 `off` 级别缺下发值时,在行下方报错并阻止保存。

## 构建

~~~sh
cd custom/ui-settings-models
../../node_modules/.bin/tsc -p .        # 类型检查(本包文件)
../../node_modules/.bin/tsdown          # 产出 lib/index.js lib/invariant.js lib/client.js
~~~

`node_modules/react`、`node_modules/@types/react` 是指向仓库 pnpm store 的软链,仅服务于本地类型检查;运行时依赖全部经浏览器模块表外部化。

## 挂载与还原

已通过 web profile 挂载(见 `~/.dsh/profiles/web/`):

- `dsh plugin --profile web add ./custom/ui-settings-models`(pnpm link,纯依赖,无 bundle 层);
- profile `cordis.patch.yml` 禁用原 `ui-settings-models` 行并插入 `ui-settings-models-custom` 行(patch 按 id+name 匹配,不支持重命名,故用 disable+insert)。

还原:删除 patch 中这两个条目并刷新页面;彻底移除再执行 `dsh plugin --profile web remove dsh-custom-ui-settings-models`。

## Model Experience

本插件只改变 Models 设置页的编辑面;不产生任何模型可见输入,不新增 session 事件,对请求前缀无影响。它编辑的 `reasoningEfforts` 决定请求中 reasoning/thinking 参数的下发形状(由 llm-pi-ai 适配器拥有)。

## Known Limitations and Deferred Work

- 思考参数编辑只覆盖 pi-ai 家族(`reasoningEfforts`);DeepSeek 官方适配器的 catalog 无对应字段,故其编辑器保持原样。
- 未同步分叉原包的测试套件(组件规格需随原包演进重写);类型检查以本包文件为准。
- 上游 `ui-settings-models` 若演进,需手工同步本分叉(复制 + 重放本 README 所列改动)。
