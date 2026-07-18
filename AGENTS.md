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

## 开发工具链与缓存

- 依赖安装、编译和测试可以读写用户目录下的工具链缓存与索引，例如 `~/Library/pnpm`、`~/.cargo` 和 `~/.rustup`。
- 优先使用用户目录缓存，不要把 pnpm、Cargo 或其它开发工具的缓存写入仓库，也不要把缓存目录加入版本控制。
- 如果运行环境限制访问用户级缓存，应申请必要权限；不要通过修改项目结构或提交缓存目录来绕过限制。

## 项目概览

**Token Hub** 是基于 Tauri 的 AI API 代理工具，继承上游 Token Proxy 的后端能力，用于转发 OpenAI、Gemini、Anthropic 等 AI API 格式，支持本地运行、token 使用统计、负载均衡和优先级管理。本项目的主要工作范围是前端 UI/UX 优化。

- 前端: React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui(pnpm dlx shadcn@latest add xxx)
- 后端: Rust (Edition 2021) + Tokio + Axum
- 桌面框架: Tauri 2

## 参考项目

- 代理转发/转换参考[litellm](.reference/litellm)
- 代理转发/转换参考[new-api](.reference/new-api)
- kiro、codex 等 2api 参考[CLIProxyAPIPlus](.reference/CLIProxyAPIPlus)
- CLIProxyAPIPlus的可视化app参考[quotio](.reference/quotio)
