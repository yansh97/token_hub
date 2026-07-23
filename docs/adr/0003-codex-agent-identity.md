# Codex Agent Identity 使用独立凭据与单次 task 恢复

Token Proxy 将 Codex Agent Identity 建模为与 OAuth 并列的 canonical 凭据类型，只导入官方 Codex 生成的 `auth.json`，不在应用内生成身份或把它降级为 token 字段。JWT 导入必须通过官方 JWKS 校验 RS256 signature、issuer、audience 和 key ID；结构化记录必须校验 PKCS#8 Ed25519 私钥。私钥只用于动态 `AgentAssertion`、task 注册签名和 sealed task ID 解密，不得进入日志、URL 或前端投影。

task ID 是持久化的账户绑定：缺失时按账户异步锁注册并在锁内重读，避免并发重复注册。上游或额度请求只有在 401 body 明确表示 `invalid_task_id`、`task_not_found` 或 `task_expired` 时，才重新注册并使用新 assertion 重放一次；普通 401 不走 task 恢复或 OAuth refresh，第二次 task-invalid 也不重新进入同上游恢复链。OAuth 旧记录在首次读取时迁移并立即回写统一 credential 格式，不保留双写模型。
