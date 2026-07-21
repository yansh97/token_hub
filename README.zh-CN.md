# Token Hub

[English](README.md) | 中文

> 本 README 在上游文档基础上进行了修改。Token Hub fork 自 [mxyhi/token_proxy](https://github.com/mxyhi/token_proxy)，专注于 UI/UX 优化，同时尽可能保持上游后端和项目结构不变。

本地 AI API 网关，支持 OpenAI / Gemini / Anthropic。本地运行、记录 Token（SQLite），按优先级负载均衡，支持可选的 API 格式互转（OpenAI Chat/Responses ↔ Anthropic Messages，Gemini ↔ OpenAI/Anthropic，含 SSE/工具/图片），并提供 Claude Code / Codex 一键配置。

## 关于本 Fork

Token Hub 构建于上游 [Token Proxy](https://github.com/mxyhi/token_proxy) 稳定的后端能力和持续的功能更新之上。本 Fork 主要进行有针对性的 UI/UX 优化，并尽可能保持原项目结构和后端行为不变，以便持续合并上游更新。

应用对外名称为 **Token Hub**。部分内部 package 名称、CLI 标识、配置字段和兼容性字符串仍保留为 `token_proxy`，以确保现有集成正常工作，并降低同步上游更新的成本。

上游项目及本 Fork 均采用 [Apache License 2.0](LICENSE) 发布。本仓库保留原项目的版权、许可证和归属声明；本 Fork 的修改通过 Git 历史和项目文档记录。

> 默认监听端口：**9208**（release）/ **19208**（debug 构建）。

---

## 你能得到什么
- 多提供商：`openai`、`openai-response`、`anthropic`、`gemini`、`kiro`、`codex`
- 内置路由，支持可选的 API 格式互转（OpenAI Chat ⇄ Responses；Anthropic Messages ↔ OpenAI；Gemini ↔ OpenAI/Anthropic，含 SSE）
- 上游优先级 + 两种策略（填满优先级组 / 轮询）
- 模型别名映射（精确 / 前缀* / 通配*），响应会回写原始别名
- 本地访问密钥（Authorization）+ 上游密钥自动注入
- SQLite 仪表盘：请求数、Token、缓存 Token、延迟、最近请求
- macOS 托盘实时 Token 速率（可选）

## 快速上手（macOS）
1) 安装：把 `Token Hub.app` 放到 `/Applications`。若被拦截，执行 `xattr -cr /Applications/Token\ Hub.app`。
2) 启动应用，代理会自动运行。
3) 打开 **设置**，编辑并保存（写入 Tauri 配置目录下的 `config.jsonc`）。默认配置可用，只需填入上游 API Key。若代理正在运行，保存后会按需自动 reload 或重启。
4) 发请求（本地鉴权示例）：
```bash
curl -X POST \
  -H "Authorization: Bearer 你的本地密钥" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:9208/v1/chat/completions \
  -d '{"model":"gpt-4.1-mini","messages":[{"role":"user","content":"hi"}]}'
```

也可以直接用 Anthropic Messages 格式（用于 Claude Code 等客户端）：
```bash
curl -X POST \
  -H "x-api-key: 你的本地密钥" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:9208/v1/messages \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":256,"messages":[{"role":"user","content":[{"type":"text","text":"hi"}]}]}'
```

## 前端测试
```bash
# watch 模式
pnpm test

# 单次运行（CI 友好）
pnpm test:run

# 覆盖率（可选）
pnpm test:coverage

# TypeScript 类型检查
pnpm exec tsc --noEmit
```

说明：
- 测试文件约定：`src/**/*.test.{ts,tsx}`。
- 全局测试初始化（Tauri mocks + jsdom polyfills）：`src/test/setup.ts`。
- Vitest 配置：`vitest.config.ts`。

## 配置参考
- 文件：`config.jsonc`（支持注释与尾随逗号）
- 位置：Tauri **AppConfig** 目录（应用自动解析）

### 核心字段
| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `host` | `127.0.0.1` | 监听地址；支持 IPv6（URL 会自动加方括号） |
| `port` | `9208`（release）/`19208`（debug） | 端口冲突时修改 |
| `local_api_key` | `null` | 设置后，本地鉴权按接口格式生效（见“鉴权规则”）；本地鉴权不会转给上游 |
| `app_proxy_url` | `null` | 应用更新 & 上游可复用的代理；支持 `http/https/socks5/socks5h`；可在 upstream `proxy_url` 用 `"$app_proxy_url"` 占位 |
| `log_level` | `silent` | `silent|error|warn|info|debug|trace`；debug/trace 会记录请求头（鉴权打码）与小体积请求体（≤64KiB）；release 强制 `silent` |
| `max_request_body_bytes` | `104857600` (100 MiB) | 0 表示回落到默认；保护入站体积 |
| `retryable_failure_cooldown_secs` | `15` | 对适合短时降级的可重试失败施加冷却窗口；`0` 表示关闭冷却。重载或重启运行中的代理会重置当前冷却状态 |
| `same_upstream_retry_count` | `1` | 可重试错误时，同一上游原地额外重试次数（不含首次发送）；`0` 关闭原地重试；最大 `5` |
| `codex_session_scoped_cooldown_enabled` | `false` | 仅对 Codex 账号 + OpenAI Responses 请求生效；开启后按 `session_id` 隔离冷却，最终成功会清除本会话冷却，缺少 `session_id` 的请求不共享冷却 |
| `tray_token_rate.enabled` | `true` | macOS 托盘实时速率；其他平台无害 |
| `tray_token_rate.format` | `split` | `combined`(总数) / `split`(↑入 ↓出) / `both`(总数 | ↑入 ↓出) |
| `upstream_strategy` | `{ "order": "fill_first", "dispatch": { "type": "serial" } }` | 结构化策略对象。`order` 控制同一优先级组内的候选顺序；`dispatch` 控制串行 / hedged / race 派发方式 |

### 上游条目（`upstreams[]`）
| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `id` | 必填 | 唯一 |
| `providers` | 必填 | 一个上游可同时服务多个 provider。特殊 provider（`kiro/codex`）不可与其它 provider 混用。 |
| `base_url` | 必填 | 完整基址，重复路径段会去重（`providers=["kiro"]` / `["codex"]` 可为空） |
| `api_key` | `null` | 该 provider 的密钥；优先于请求头 |
| `kiro_account_id` | `null` | `providers=["kiro"]` 时必填 |
| `preferred_endpoint` | `null` | `kiro` 专用：`ide` 或 `cli` |
| `proxy_url` | `null` | 每个上游独立代理，支持 `http/https/socks5/socks5h`；默认**不走系统代理**；支持 `$app_proxy_url` |
| `priority` | `0` | 越大越先尝试；同组按列表顺序或轮询 |
| `enabled` | `true` | 可临时禁用上游 |
| `model_mappings` | `{}` | 精确 / `前缀*` / `*`；优先级：精确 > 最长前缀 > 通配；响应回写原始模型别名 |
| `convert_from_map` | `{}` | 显式声明允许从哪些入站格式转换后使用该 provider。例：`{ "openai-response": ["openai_chat", "anthropic_messages"] }` |
| `overrides.header` | `{}` | 设置/删除 header（null 表示删除）；hop-by-hop/Host/Content-Length 永远忽略 |

## 路由与格式转换
- Gemini 原生 API：`/v1beta/models/*`（包括 `:generateContent`、`:streamGenerateContent`、`:countTokens`、`:embedContent`、`:batchEmbedContents`）、模型目录/详情、`/v1beta/files*`、`/upload/v1beta/files*`、`/v1beta/cachedContents*`、`/v1beta/tunedModels*` → `gemini`
- Anthropic：`/v1/messages`（含子路径）与 `/v1/complete` → `anthropic`（Kiro 同格式）
- OpenAI 创建接口：`/v1/chat/completions` → `openai`；`/v1/responses` → `openai-response`
- OpenAI 原生 pass-through 资源路由会被显式钉到 OpenAI-compatible provider，不再掉入 `anthropic`：`chat/completions/*`、`responses/*`、`assistants*`、`threads*`、`conversations*`、`chatkit*`、`containers*`、`evals*`、`files*`、`uploads*`、`batches*`、`vector_stores*`、`images/*`、`audio/*`、`embeddings`、`moderations`、`completions`、`fine_tuning/*`、`realtime/*`、`skills*`、`videos*`
- `responses/*` 资源优先选 `openai-response`，缺失时回退 `openai`；其它 OpenAI 原生资源优先选 `openai`，缺失时回退 `openai-response`
- 其他路径：按已配置 provider 的最高优先级选择；优先级相同则按 `openai` > `openai-response` > `anthropic` 打破平局
- 跨格式 fallback/转换由 `upstreams[].convert_from_map` 控制（不再有全局开关）；若某个 provider 在该入站格式下没有任何可用 upstream，则不会被选中。
- `/v1/chat/completions` 缺少 `openai`：可 fallback 到 `openai-response` / `anthropic` / `gemini`（按优先级选择，平级优先 `openai-response`）
- `/v1/messages`：在 `anthropic` 与 `kiro` 间按优先级选择；平级按 upstream id 排序。若命中 provider 返回“可重试错误”，且另一个 native provider 已配置，则会自动 fallback（Anthropic ↔ Kiro）
- 当 `/v1/messages` 缺少 `anthropic` 且 `kiro` 也不存在时：其它 provider 若在 `convert_from_map` 中允许 `anthropic_messages`，则可 fallback 到 `openai-response` / `openai` / `gemini`（按优先级选择，平级优先 `openai-response`）
- `/v1/responses` 缺少 `openai-response`：可 fallback 到 `openai` / `anthropic` / `gemini`（按优先级选择，平级优先 `openai`）
- `/v1beta/models/*:generateContent` 或 `*:streamGenerateContent` 缺少 `gemini`：可 fallback 到 `openai-response` / `openai` / `anthropic`（按优先级选择，平级优先 `openai-response`）
- 其它 Gemini 原生端点仅支持 pass-through，必须配置 `gemini` upstream

## 鉴权规则（重要）
- 本地访问：设置了 `local_api_key` 必须按接口格式携带本地 key，且这些本地鉴权不会转发给上游
  - 公开白名单：`GET` / `HEAD` `/v1/models` 与 `/v1beta/openai/models` 不需要本地 key
  - OpenAI / Responses：`Authorization: Bearer <key>`
  - Anthropic `/v1/messages`：`x-api-key` / `x-anthropic-api-key`
  - Gemini 原生 API：`x-goog-api-key` 或 `?key=...`
- 启用 `local_api_key` 时，请求头不会用于上游鉴权；请在 `upstreams[].api_key` 配置上游 key
- 上游鉴权解析（逐请求）：
  - **OpenAI**：`upstream.api_key` → `x-openai-api-key` → `Authorization`（仅当未设置 `local_api_key`）→ 报错
  - **Anthropic**：`upstream.api_key` → `x-api-key` / `x-anthropic-api-key` → 报错；若缺少 `anthropic-version` 自动补 `2023-06-01`
  - **Gemini**：`upstream.api_key` → `x-goog-api-key` → 查询参数 `?key=` → 报错

## 负载均衡与重试
- 优先级：高优先级组先尝试。
- `upstream_strategy.order` 控制同一优先级组内的选择顺序：
  - `fill_first`：保持配置列表顺序。
  - `round_robin`：跨请求轮换起点。
- `upstream_strategy.dispatch` 控制同一优先级组内的发起方式：
  - `{"type":"serial"}`：一次只尝试一个候选。
  - `{"type":"hedged","delay_ms":2000,"max_parallel":2}`：先立即发第一个；若 `delay_ms` 后仍未决，再补发下一个，最多并发到 `max_parallel`。
  - `{"type":"race","max_parallel":3}`：立即并发发起最多 `max_parallel` 个候选，谁先成功就返回谁。
- 可重试条件：网络超时/连接错误，或状态码 400/401/403/404/408/422/429/307/5xx（包含 504/524）；重试只在同一 provider 的优先级组内进行
- 原地重试：命中可重试错误时，先对**同一上游**再试最多 `same_upstream_retry_count` 次（默认 `1`，不含首次），用尽后再跨上游切换；流式已产出首个客户端可见输出后不再原地重放
- 冷却条件：`401/403/408/429/5xx` 会让失败 upstream 在 `retryable_failure_cooldown_secs`（默认 `15`）内被暂时后置；`400/404/422/307` 仍可重试，但不会触发跨请求冷却。`codex_session_scoped_cooldown_enabled=true` 时，Codex 账号的 OpenAI Responses 冷却按 `session_id` 隔离；最终成功的请求不会保留本会话冷却，缺少 `session_id` 的请求不共享冷却
- 仅 `/v1/messages`：当命中的 native provider（`anthropic`/`kiro`）被耗尽（仍是可重试错误）时，若另一个 native provider 已配置，会自动 fallback（Anthropic ↔ Kiro）

## 可观测性
- SQLite 日志：`data.db` 位于配置目录，记录每次请求（tokens、cached tokens、延迟、模型、上游）
- Token 速率：macOS 托盘可显示总速率或分向（由 `tray_token_rate` 决定）
- debug/trace 日志的请求体最大 64KiB

## Dashboard
- 应用内 **Dashboard** 展示总览、Token 使用趋势、**模型用量**排行（Top 20）、上游可用模型探测
- 支持时间范围、提供商和模型筛选；筛选条件作用于汇总、趋势和模型用量
- 最近请求在 **Logs** 页查看（分页 50，支持 offset）
- Logs 面板支持“记录 30 秒内请求详情”：开启后会在 30 秒窗口内记录请求 header/body，失败请求的错误响应始终保留，到时自动关闭

## FAQ
- **端口被占用？** 修改 `config.jsonc` 里的 `port`，并同步更新客户端 base URL
- **返回 401？** 设置了 `local_api_key` 就必须按接口格式发送本地 key（OpenAI/Responses 用 `Authorization`；Anthropic 用 `x-api-key`；Gemini 用 `x-goog-api-key` 或 `?key=`）；开启本地鉴权后，上游密钥请配置在 `upstreams[].api_key`
- **返回 504？** 上游在 120 秒内未返回响应头或首个 body chunk。对于流式响应，若相邻 chunk 间空闲超过 120 秒，连接也可能被关闭。
- **413 Payload Too Large？** 请求体超过 `max_request_body_bytes`（默认 100 MiB）或格式转换处理上限
- **为什么不走系统代理？** `reqwest` 默认 `no_proxy()`；如需代理，请在每个 upstream 设置 `proxy_url`
