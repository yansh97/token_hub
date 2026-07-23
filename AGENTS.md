# Token Hub 代码库规则

本文件为在 `token_hub` 项目中工作的 AI 智能体提供指导。

> 本文件已从上游项目修改。Token Hub fork 自 [mxyhi/token_proxy](https://github.com/mxyhi/token_proxy)，主要进行 UI/UX 优化，并尽可能保持上游后端能力、项目结构和同步路径稳定。

## 项目关系与许可证

- 上游项目：[mxyhi/token_proxy](https://github.com/mxyhi/token_proxy)
- 当前项目：[yansh97/token_hub](https://github.com/yansh97/token_hub)
- 许可证：[Apache License 2.0](LICENSE)
- 保留上游版权、许可证和归属声明；修改文件应明确说明已修改。
- 优先通过小范围、易同步的提交维护 UI/UX 改进，避免无必要地改动后端和项目结构。
- 上游更新应优先合并；若 UI/UX 调整与上游变更冲突，应尽量将冲突限制在前端边界内。

## 发布与上游同步

- Token Hub 的自动发布提交标志为 `chore: token-hub release vX.Y.Z`。
- 不要使用通用的 `chore: release vX.Y.Z`，该格式可能来自上游，不能触发 Token Hub 发布。
- Token Hub 使用独立版本号；`.upstream-version` 记录当前同步的上游版本，并由发布工作流写入 GitHub Release 说明。每次合并上游后必须同步更新该文件。
- 发布前需确认版本号、Tauri 更新源、签名公钥和 `Token.Hub` 发布资产匹配规则保持一致。
- 合并上游时保留 Token Hub 的应用标识、更新源和签名配置；上游版本号和功能代码应正常同步。

### 同步边界

- 上游同步必须在独立分支上通过真实 merge commit 完成；不要用 `git merge -s ours` 伪造同步状态。
- 接受 `crates/**`、配置 schema 与持久化数据、Tauri command/event 合约，以及必要的安全与工具链更新。
- 保留 Token Hub 的 `src/**` UI 实现、中文文案、本地 Hash 路由、Base UI 与本地基础组件；拒绝上游页面、路由、国际化和账户管理 UI 的整体替换。
- `package.json` 与锁文件按依赖职责合并：保留仍在使用的前端依赖与独立工具链，移除不再使用的历史依赖；不要整文件接受任一侧版本。
- 配置编辑与保存必须保留未知字段，确保新版前端能与上游后端和已有数据双向兼容。
- 合并后至少验证 Rust 测试、Tauri command 编译、前端类型检查、测试、生产构建和配置兼容性。

## 开发工具链与缓存

- 依赖安装、编译和测试可以读写用户目录下的工具链缓存与索引，例如 `~/Library/pnpm`、`~/.cargo` 和 `~/.rustup`。
- 优先使用用户目录缓存，不要把 pnpm、Cargo 或其它开发工具的缓存写入仓库，也不要把缓存目录加入版本控制。
- 如果运行环境限制访问用户级缓存，应申请必要权限；不要通过修改项目结构或提交缓存目录来绕过限制。

## 项目概览

**Token Hub** 是基于 Tauri 的 AI API 代理工具，继承上游 Token Proxy 的后端能力，用于转发 OpenAI、Gemini、Anthropic 等 AI API 格式，支持本地运行、token 使用统计、负载均衡和优先级管理。本项目的主要工作范围是前端 UI/UX 优化。

- 前端: React 19 + TypeScript + Vite + Tailwind CSS v4 + Base UI（复杂交互）+ 本地 UI 组件
- 后端: Rust (Edition 2021) + Tokio + Axum
- 桌面框架: Tauri 2

## 前端视觉规范

- 以默认窗口 `1064×658` 的桌面工具密度为基准，并验证更宽窗口下的对齐与响应式布局。
- 字号层级固定为：页面标题 `17px`、区块标题 `15px`、对话框标题 `14px`、正文/字段 `13px`、辅助文字和表头 `11–12px`。仅核心指标数字可使用更大字号。
- 常规交互控件统一为 `32px` 高；优先使用基础组件的默认尺寸，不在页面内重复覆盖高度和字号。内联徽标操作等确有空间约束的控件可更小。
- 图标默认 `16px`，次级紧凑图标可用 `14px`；同类操作保持一致。
- 颜色必须使用 `foreground`、`muted-foreground`、`primary`、`success`、`destructive` 等语义 token，不直接使用具体色阶或硬编码前景色。
- 键盘焦点统一使用 `2px`、`ring/20`；不要用过粗焦点环，也不要移除可见焦点。
- 页面、弹窗和表格应优先复用 `src/components/ui` 的基础组件，避免通过父级后代选择器批量覆盖控件样式。

## 参考项目

- 代理转发/转换参考[litellm](.reference/litellm)
- 代理转发/转换参考[new-api](.reference/new-api)
- kiro、codex 等 2api 参考[CLIProxyAPIPlus](.reference/CLIProxyAPIPlus)
- CLIProxyAPIPlus的可视化app参考[quotio](.reference/quotio)
