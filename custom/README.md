# custom/ — Out-of-Tree 插件开发区

本目录存放所有自定义开发插件。两条硬性约定:

1. **一切皆插件**:新功能只挂文档化扩展点(``ctx.effect`` / ``ctx.on`` / waterfall / 能力缝三角色),不改 ``packages/`` 下任何现有包、不改 agent-loop。
2. **不覆盖项目**:不改 shipped bundles 的 ``cordis.patch.yml``;对 dsh-base 行为的调整在自己包的 patch 层按行 id 整行重声明(合法组合,后层覆盖前层)。

机制依据:``docs/user/develop/basic/publish.md``(profile 持有 out-of-tree 插件);架构总览见 ``../architecture-diagrams/architecture.md``,开发项清单见 ``../architecture-diagrams/plugin-dev-backlog.md``。

## 目录约定

每个子目录是一个独立插件包:

```
custom/&lt;name&gt;/
├── package.json         声明 "dsh": {"bundle": {"patch": "./cordis.patch.yml"}}
├── cordis.patch.yml     本插件贡献的 insert 行(以及按 id 的整行覆盖)
├── src/
│   ├── index.ts         入口(service 包 default-export 类;函数插件 named-export name/inject/Config/apply)
│   └── types.ts         只有类型
├── tests/               包级测试
├── invariant.ts         注册 manifest 名,检查事件/数据关系
└── README.md            含 Model Experience 与 Known Limitations
```

## 挂载工作流

```sh
# 安装到 custom profile(dsh 自动 pnpm link + 追加 dsh.profile.bundles)
dsh plugin --profile custom add ./custom/&lt;name&gt;

# 验证组合层(不 boot)
dsh --profile custom --dump-config

# 运行
dsh --profile custom

# 卸载(依赖与层一起移除,组合干净回到 dsh-base + 其余层)
dsh plugin --profile custom remove &lt;name&gt;
```

## 加载顺序

空 entry 列表 → ① ``@deepseek-ai/dsh-base`` → ② custom bundles(``dsh.profile.bundles`` 顺序)→ ③ profile 的 ``cordis.patch.yml`` → ④ ``$DSH_HOME/cordis.patch.yml`` → ⑤ ``--patch`` overlay。

后层按行 id 覆盖前层,整行替换不合并。in-box 插件名经 ``$DSH_HOME/profiles/node_modules`` 平铺 fallback 可解析;对 ``@deepseek-ai/dsh-*`` 的依赖由 profile 的 pnpm 解决。

## 质量门槛(每个插件包)

- 注册即效果:一切贡献走 ``ctx.effect()`` / ``ctx.on()``,返回 disposer;HMR 安全测试证明 dispose 后移除。
- 能力缝三角色齐全(Definition / Provider / Consumer);依赖 Service Definition,永不依赖具体 Provider。
- Model-visible ⟺ logged:新增模型可见输入需要新 session 事件,或走持久状态确定性投影(设计决策记 Agent Note)。
- 无硬编码 tunables:部署可变的值是验证过的 Config 字段。
- REAL-composition 测试:经 ``--profile custom`` 或 Loader 起等价 cordis.yml;模型/用户可见行为加 keyless snapshot。
