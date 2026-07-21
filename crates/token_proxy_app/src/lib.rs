//! Token Proxy 应用运行时：不依赖 Tauri，可供 CLI/Tauri adapter 复用。
//!
//! 设计原则：
//! - App 不直接依赖 Tauri
//! - 账户与纯协议能力由 leaf crates 提供
//! - CLI/Tauri 通过 [`app::TokenProxyApp`] 组装运行时

pub mod app;
pub mod logging;
pub mod storage_usage;

pub mod proxy;
