# Token Hub 代码库指南

本文件约束 `token_hub` 的代码修改、上游同步、验证和发布。Token Hub fork 自 [mxyhi/token_proxy](https://github.com/mxyhi/token_proxy)，维护独立的桌面端 UI/UX，并尽量跟随上游后端能力和工程结构。

## 项目边界

- 当前仓库：[yansh97/token_hub](https://github.com/yansh97/token_hub)
- 上游仓库：[mxyhi/token_proxy](https://github.com/mxyhi/token_proxy)
- 技术栈：Tauri 2、React 19、TypeScript、Vite、Tailwind CSS v4、Rust 2021、Tokio、Axum。
- `src/**` 是 Token Hub 独立维护的前端；`crates/**` 和 `src-tauri/**` 原则上跟随上游。
- 应用对外名称是 **Token Hub**。内部 package、crate、配置键和兼容字符串中的 `token_proxy` 不做无意义重命名。
- 保留上游版权、许可证和归属声明。

## 工作原则

1. 只修改完成当前任务所需的文件和行，不顺手重构或清理无关代码。
2. 优先复用现有组件、helper、类型和工程模式；没有明确收益时不增加抽象或依赖。
3. 配置读取、编辑和保存必须保留未知字段，确保与上游后端和已有数据兼容。
4. 工作区可能包含其他未提交改动。不要回滚、覆盖或混入无关改动。
5. `.github/release-matrix.json` 是桌面发布平台的唯一矩阵来源；`.upstream-version` 只记录已同步的上游稳定版本。

## 开发与验证

按改动风险选择验证：

- 前端逻辑或组件：`pnpm test:run`
- 前端类型和生产构建：`pnpm build`
- 相关文件静态检查：`pnpm exec biome check <files...>`
- Rust workspace：`cargo test --workspace --locked`
- 发布 guard：`node --test scripts/release-guard.test.mjs`

影响发布、共享组件、配置兼容或前后端合约时必须扩大验证范围。未运行应有测试时，交付中明确说明。工具链缓存使用用户目录，不写入仓库。

前端测试只覆盖关键业务流程、数据转换与兼容性、跨层调用、异步竞态和可访问交互契约；不要测试 Tailwind class、纯视觉尺寸、文案或第三方组件自身行为。

## 前端规范

- 以默认窗口 `1064×658` 的桌面工具密度为基准，并检查更宽窗口的布局。
- 字号：页面标题 `17px`，区块标题 `15px`，对话框标题 `14px`，正文/字段 `13px`，辅助文字和表头 `11–12px`。
- 常规控件高 `32px`；图标默认 `16px`，紧凑图标可用 `14px`。
- 使用 `foreground`、`muted-foreground`、`primary`、`success`、`destructive` 等语义 token，不硬编码前景色。
- 保留可见键盘焦点，统一使用 `2px` 和 `ring/20`。
- 优先复用 `src/components/ui`；修改全局基础组件前检查所有使用方，不通过页面级 CSS 批量覆盖其行为。

## 上游同步

- 在独立分支使用真实 merge commit；不得使用 `git merge -s ours` 伪造同步状态。
- 同步上游后端、配置 schema、持久化数据、Tauri command/event 合约，以及必要的安全和工具链更新。
- 上游开发文档不需要保留；上游前端改动也不纳入同步。涉及前端的新功能或合约变化，应在后端同步完成后，按 Token Hub 现有架构、中文文案、Hash 路由和组件体系单独适配。
- 保留 Token Hub 的应用标识、更新源、签名公钥和发布资产命名。
- `package.json` 和锁文件按实际依赖合并，不整文件接受任一侧。
- 同步后更新 `.upstream-version`，并验证 Rust workspace、Tauri command 编译、前端类型、测试、生产构建和配置兼容性。

## 版本与发布

- Token Hub 使用独立的 `X.Y.Z` 稳定版本，不追随上游版本号。
- 版本在 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`src-tauri/tauri.conf.dev.json` 和 `Cargo.lock` 中必须一致。
- 正式发布要求版本高于最新稳定 tag，且对应 `vX.Y.Z` tag 不存在；发布资格不依赖 merge commit 标题。
- 发布分支为 `release/vX.Y.Z`，PR 标题为 `chore: token-hub release vX.Y.Z`。
- 不手动修改发布版本文件、打稳定 tag、发布草稿或跳过 Test。`republish=true` 只用于修复已有稳定 tag 的 Release 或资产。
- 发布矩阵包含 macOS Apple Silicon、macOS Intel、Windows x64、Linux x64 和 Linux ARM64。修改 runner、target、架构或产物命名时，同时检查发布矩阵、Tauri updater 配置、`scripts/generate-updater-json.mjs` 和 Release workflow。

## 参考项目

- 代理转发与协议转换：[litellm](.reference/litellm)、[new-api](.reference/new-api)
- Kiro、Codex 等 2API：[CLIProxyAPIPlus](.reference/CLIProxyAPIPlus)
- CLIProxyAPIPlus 桌面端参考：[quotio](.reference/quotio)
