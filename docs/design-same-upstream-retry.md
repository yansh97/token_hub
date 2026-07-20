# 设计：原地重试次数可配置

状态：已实现；2026-07-20 补充请求修复与 retry scope
日期：2026-07-15

## 1. 问题

可重试失败时，代理已对**同一上游**做“原地重试”，但：

1. 次数硬编码为 **1**（`retry_same_upstream_once` + `retried_same_upstreams` 去重）
2. 无法通过配置关闭或加大次数

需求：默认原地重试 1 次，次数全局可配置。

## 2. 现状（事实）

### 2.1 两层“重试”

| 层 | 行为 | 是否已可配 |
| --- | --- | --- |
| **原地重试**（same upstream） | 同一 `UpstreamRuntime` 再发一次，再考虑换上游 | 否（固定 1） |
| **跨上游 failover** | 优先级组内换候选；`/v1/messages` 另有 anthropic↔kiro | 顺序/派发可配；次数=组内候选数 |

### 2.2 谁有资格触发“原地”

仅当 `AttemptOutcome::Retryable.retry_same_upstream_once == true`：

- 响应头前 transport：`TransportRecovery::SameUpstreamOnce`（request/timeout 等；**connect / proxy marker 直接 NextUpstream**）
- 流式语义（如 capacity）且**尚未产出首个客户端可见输出**
- 普通 4xx/5xx 可重试状态：当前标志为 **false**，不走原地，直接跨上游

### 2.3 调度伪代码（现状）

```text
on attempt complete(item_index, outcome):
  if outcome.retry_same_upstream_once
     AND item_index not in retried_same_upstreams:
       record first failure
       re-attempt same upstream once
  else:
       record and possibly failover
```

## 3. 目标与非目标

### 目标

- 配置项控制**每个上游、每次请求内**的额外原地尝试次数
- 默认 `1`（与现网行为对齐）
- `0` = 关闭原地重试（资格命中也直接跨上游）
- `N` = 最多连续原地重试 N 次（首次失败后最多再 N 次）
- 配置热加载后对新请求生效（与其它核心字段一致）
- 全链路：serde 配置、校验、运行时、Dashboard 表单、i18n、README、测试

### 非目标（本版不做）

- 不改跨上游策略语义（serial/hedge/race）
- 不引入指数退避 / Retry-After 解析（可后续加）
- 不 per-upstream 覆盖（除非审核要求）
- 不改 codex 多账号 failover / kiro refresh 逻辑（它们在 attempt 内部，先于 dispatch 原地层）
- 不默认把“全部可重试 HTTP 状态”扩成原地（见关键决策 A）

## 4. 关键决策

### 决策 A — 原地资格范围（**已确认：A2**）

| 选项 | 说明 | 取舍 |
| --- | --- | --- |
| A1 保持现有资格 | 仅 transport `SameUpstreamOnce` + 流式首包前语义错误 | 改动小，但不覆盖普通 4xx/5xx |
| **A2 所有 `Retryable` 先原地（已选）** | 任何 `AttemptOutcome::Retryable` 都先原地最多 N 次，再跨上游 | 贴合“遇错先原地”；401/429 等可能多 1 次延迟；冷却仍按现逻辑标记 |
| A3 可配资格模式 | `eligible: transport_only \| all_retryable` | 首版不做 |

**确认实现：**

- 调度层判断改为：`matches!(outcome, AttemptOutcome::Retryable { .. })` 且 `used < same_upstream_retry_count`
- **不再依赖** `retry_same_upstream_once` 资格位做 gating（该字段可删除或仅保留日志诊断）
- **仍禁止原地**的情况（硬边界，不变）：
  - `Fatal` / `SkippedAuth` / `Success`
  - 流式**已产出首个客户端可见输出**后的错误（当前不会变成 Retryable 带重放，保持）
- 原地耗尽后：原样进入跨上游 failover + cooldown

### 决策 B — 配置语义（**已确认**）

字段名：

```text
same_upstream_retry_count: u64  // 默认 1，上限 5
```

语义（严格）：

> 对任意 `AttemptOutcome::Retryable`，在**同一请求、同一 group item（上游）**上，最多再发起 `same_upstream_retry_count` 次完整 `attempt_upstream`。

- 首次发送不算入 count（总 send 最多 `1 + N`）
- 连续 Retryable 可继续原地直到用尽 N
- 中途 Success / Fatal → 立即结束该路径
- `0`：关闭原地，Retryable 直接跨上游（比现网更“激进地 failover”）

上限：**5**（已确认）。

### 决策 C — 内部标志清理（随 A2）

A2 下调度不再读资格 bool：

| 动作 | 说明 |
| --- | --- |
| 删除或停用 gating 用的 `retry_same_upstream_once` | `AttemptOutcome::Retryable` 可去掉该字段 |
| `RetryableStreamResponse.retry_same_upstream_once` | 可删除；流式 Retryable 一律可进原地计数 |
| `TransportRecovery::SameUpstreamOnce` | 可简化为 `NextUpstream`（均可跨上游）；或保留仅作诊断 log，**不再单独控制是否原地** |
| 日志 | `same_upstream_retry attempt=i max=N` |

（实现时优先删干净无用字段，避免双路径；项目无 BC 负担。）

### 决策 D — 配置归属（**已确认：全局**）

与 `retryable_failure_cooldown_secs` 同级，Proxy Core 卡。

### 决策 E — 冷却与日志

- 每次失败的 `should_cooldown` 仍在 `apply_group_attempt_outcome` 时处理（本版不改冷却时机）
- 日志：每次原地重试 `info`：`provider` / `upstream` / `attempt` / `max` / `retry_result`

## 5. 设计方案

### 5.1 配置模型

`ProxyConfigFile`：

```rust
// default = 1, skip_serializing_if default
pub same_upstream_retry_count: u64,
```

`ProxyConfig`（运行时）：

```rust
pub same_upstream_retry_count: u32, // 校验后收窄
```

默认：`1`  
缺失字段：按 default（旧配置无需迁移）  
`No backward compatibility`：内部 bool 字段可直接改名，无需保留旧 JSON key

校验（`config/mod.rs`）：

- 必须是整数（前端同）
- `<= MAX`（建议 5）
- 过大返回明确错误字符串，与 cooldown 一致风格

### 5.2 调度改动（核心）

`dispatch_group_upstreams`：

```text
// 推荐：对 complete 的 item 做同步内层循环，不维护跨 complete 的 map 也行
// 若 hedge 下同一 item 不会并行两次 complete，内层 while 足够

on complete(item_index, outcome):
  used = 0
  current = outcome
  max = state.config.same_upstream_retry_count
  loop:
    apply_group_attempt_outcome(current)  // 记账/冷却；Success 则 return
    if current is not Retryable:
      break  // Fatal 已处理；非 Retryable 结束该 item
    if used >= max:
      break  // 耗尽 → 外层继续 launch 下一候选
    used += 1
    log retry attempt=used max=max
    current = attempt_upstream(same item)
  // 然后按 dispatch_plan 补发其它候选
```

实现注意：

1. **内层 while / loop**：连续原地，避免 FuturesUnordered 重入。
2. hedged/race：complete 后同步原地；不把原地放进并行槽。
3. `attempted`：每次 apply +1。
4. **行为 diff（相对现网）**：原先仅 disconnect/capacity 原地 1 次；A2 后所有 Retryable（含 429/5xx 等）默认也原地 1 次。既有“仅 once 类错误原地”的测试需扩展/改写断言。

### 5.3 内部清理

- 去掉 `retry_same_upstream_once` 全链路字段与 `should_retry_same_upstream_once`
- transport recovery 不再区分 SameUpstreamOnce vs NextUpstream 的“是否原地”（次数统一由 config）；可选合并 recovery 枚举为 Fatal | RetryableNext
- 次数**只读** `state.config.same_upstream_retry_count`

### 5.4 前端

- `src/features/config/types.ts`：字段
- `form.ts`：default `"1"`，parse/validate 非负整数 + 上限
- `proxy-core-card.tsx`：与 cooldown 相邻的 number input
- `messages/zh.json` + `en.json`：label / help / error
- `form.test.ts`：默认与自定义序列化

### 5.5 文档

- `README.md` / `README.zh-CN.md`：核心字段表 + 负载均衡与重试小节说明“先原地最多 N 次，再组内跨上游”
- `CONTEXT.md`：可选增加术语 **Same-Upstream Retry**

### 5.6 测试计划

| 用例 | 期望 |
| --- | --- |
| 默认 `1` + disconnect/capacity | 同 upstream 共 2 次 send 后成功或 failover（更新既有 once 测试） |
| 默认 `1` + 普通 5xx/429 Retryable | **新行为**：同 upstream 再试 1 次，再跨上游 |
| `same_upstream_retry_count=0` | 任意 Retryable 不二次请求，直接 failover |
| `=2` | 前两次失败第三次成功 → 同 upstream 3 次 send |
| `=2` 全失败 | 同 upstream 3 次后换下一候选 |
| 首包后不可重放错误 | 仍不进 Retryable / 不原地（回归） |
| 配置校验 | `6` 拒绝保存 |
| 前端 form | 默认 1、改 3 写入 payload |

## 6. 数据流

```text
Client request
  → select priority group / order
  → attempt upstream A
      → Retryable + eligible
          → (1..N) same-upstream re-attempt   // N = same_upstream_retry_count
      → still Retryable or non-eligible
          → next upstream / next group / error response
```

## 7. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| N 过大拉高尾延迟 | 硬上限 + UI help 说明 |
| 扩大资格到全部 Retryable 导致 401 空转 | 默认 A1；A2 需单独审核 |
| 与 hedge 并发重复计费 | 保持“complete 后同步原地”，不并行原地 |
| 冷却在原地前已标记导致同请求后续被排序后置 | 保持现状（同请求 order 已固定）；不本版改 cooldown |

## 8. 实现拆分（审核通过后）

### PR1 — 配置 + 校验 + 运行时调度

- `types` / normalize / validate
- `dispatch` count 循环
- 字段改名 `retry_same_upstream`
- Rust 单测 + 集成测试 0/1/N

### PR2 — 前端 + i18n + README

- form / card / messages / README 中英
- Vitest form

可合并为单 PR（改动内聚）；若单 PR 过大再拆。

## 9. 成功标准（可验证）

1. 默认 `1`：任意 Retryable 对同 upstream 最多额外 1 次
2. 配置 `0`：不再原地
3. 配置 `2`：同 upstream 最多 3 次 attempt
4. Dashboard 可读写并热更新
5. 相关 Rust + 前端测试 / lint / typecheck 通过

## 10. Open Questions

已全部确认。冷却时机本版不改。

## 11. Request Repair Retry 与 Retry Scope

普通 Same-Upstream Retry 原样重放请求；Request Repair Retry 根据上游的精确 400 拒绝修改请求，两者必须分开计数：

- `unknown_parameter` / `unsupported_parameter`：仅删除顶层 `max_output_tokens` 或指定 `input[n].namespace`，最多 6 次，SHA-256 去重。
- xAI `invalid-argument` 且错误同时包含 `decrypt`、`encrypted_content`：仅删除 reasoning item 的 `encrypted_content`，最多 1 次。
- 修复固定在同一 runtime upstream、账号/API key 和 prompt cache identity 上执行，不消耗 `same_upstream_retry_count`。
- 修复后的 effective body 继续用于普通原地重试、同组 failover 和后续优先级组，不能回退原始 body。

Retryable 响应携带内部 scope：

| Scope | 行为 |
| --- | --- |
| `SameThenNext` | 先按 `same_upstream_retry_count` 原地重试，再 failover |
| `NextOnly` | 跳过原地重试，直接 failover |

HTTP 413 必须读取错误体：context-window 超限是终态；其它 413 视为节点请求体上限，使用 `NextOnly`，避免向同一节点原样空转。

## Key Decisions（已确认）

1. **A2**：所有 `Retryable` 先原地，次数全局可配。
2. **字段** `same_upstream_retry_count`，默认 `1`，上限 `5`。
3. **全局** Proxy Core 配置，非 per-upstream。
4. **删除** 内部 once 资格位 gating。
5. **首包后不重放** 边界不变；**同步原地** 不进并行槽。
6. **冷却时机** 不变。
