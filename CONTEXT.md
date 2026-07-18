# Token Proxy

Token Proxy 统一不同 AI Provider 的请求、响应、用量与计费语义，使 Dashboard 和成本统计使用同一套领域语言。

## Language

**Total Input**:
一次请求处理的全部输入 token，包括未缓存输入、缓存读取、缓存写入和图像输入。
_Avoid_: Prompt tokens（Provider 口径不一致）

**Cache Read**:
从既有提示缓存中复用的输入 token；只有 Cache Read 才构成缓存命中。
_Avoid_: Cached tokens（可能混入缓存写入）

**Cache Write**:
写入或创建提示缓存的输入 token，包括普通、5 分钟和 1 小时缓存写入；它属于输入，但不是缓存命中。
_Avoid_: Cache hit, cached input

**Cache Hit Rate**:
Cache Read 占 Total Input 的比例。
_Avoid_: Cache activity rate

**Usage Breakdown**:
将 Provider 原始用量拆成未缓存输入、Cache Read、各类 Cache Write、输出和图像 token 的规范化用量。
_Avoid_: Cached total

**Error Request**:
最终 HTTP 状态码大于等于 400 的请求记录；它不参与长期请求统计，保留期（7 天）结束后整条删除。
_Avoid_: 仅以 response_error 是否存在判断错误请求

**Request Detail**:
为临时排障捕获的请求头、请求体、响应体和客户端 IP；不包含请求统计字段、`usage_json` 或错误摘要。成功请求的 Request Detail 在 7 天后清空，日志行本身永久保留。
_Avoid_: Request Log（请求日志整行）、Usage Breakdown 原始 JSON

**Success Request Log**:
`status < 400` 的请求日志行；永久保留，用于长期用量与成本统计。可清空 Request Detail，但不得删除整行，也不得清空 `usage_json` 与规范化 token/成本字段。
_Avoid_: 成功日志 90 天过期删除

**可用模型白名单**:
单个上游声明可以接收的入站模型集合。未配置或集合为空表示不限制模型；非空时仅允许精确匹配的模型参与该上游路由。
_Avoid_: 模型列表（容易与上游探测结果混淆）、模型映射

**模型映射**:
将客户端请求中的模型名改写为目标上游模型名的规则。它只负责改名，不决定模型能否路由到该上游。
_Avoid_: 可用模型、模型白名单

**Same-Upstream Retry（原地重试）**:
可重试失败后，在切换到其它上游之前，对同一上游额外再发的次数；由全局配置 `same_upstream_retry_count` 控制，默认 1，0 表示关闭。
_Avoid_: 跨上游 failover、冷却

**Responses Stream Event**:
`/v1/responses` 流中的单个 JSON 生命周期事件。每个事件都必须携带单调递增的 `sequence_number`；错误终止事件也不例外。`[DONE]` 是流结束哨兵，不是事件，不编号。
_Avoid_: SSE Chunk（传输分块可能拆分或合并事件）
