# xAI OAuth 使用受信双端点路由

Token Proxy 将 xAI OAuth 账户与 xAI API Key 上游分开建模：普通文本 Responses 请求固定路由到 `cli-chat-proxy.grok.com`，仓库已有图片、视频和 CLI 网关不支持的 Responses Compact 请求固定路由到 `api.x.ai`，OAuth token 只能发送到 xAI OIDC 与这两个官方主机。我们拒绝为账户型 xAI provider 暴露自定义 base URL，因为便利性不足以抵消 bearer token 外发和 CLI/公开 API 合同混淆的风险。
