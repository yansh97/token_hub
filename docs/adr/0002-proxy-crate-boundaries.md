# 将代理引擎拆为 protocol、storage 与 runtime

代理代码按稳定依赖边界拆为纯计算 `token_proxy_protocol`、SQLite concrete adapter `token_proxy_storage` 和承担 HTTP、重试、调度及副作用编排的 `token_proxy_runtime`，由 `token_proxy_app` 统一组合并向 CLI/Tauri 提供应用用例。SQLite 当前只有一个实现且可用内存数据库替代测试，因此不建立 repository trait；同时不按 provider 或 API format 继续切浅 crate，避免扩大 DTO 和跨 crate 接口。
