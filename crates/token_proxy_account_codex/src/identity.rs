//! Codex 官方客户端身份合同，供代理、models manifest 与配额探针共用。

pub const CLIENT_VERSION: &str = "0.144.1";
pub const DEFAULT_ORIGINATOR: &str = "codex_cli_rs";
pub const USER_AGENT: &str = "codex_cli_rs/0.144.1 (token_proxy)";

const MINIMUM_CLIENT_VERSION: [u64; 3] = [0, 144, 0];

/// 仅提升调用方已经携带的低版本，不要求普通代理请求新增 `version` 头。
pub fn enforce_minimum_client_version(version: &str) -> &str {
    let version = version.trim();
    if parse_version(version).is_some_and(|version| version >= MINIMUM_CLIENT_VERSION) {
        version
    } else {
        CLIENT_VERSION
    }
}

/// 官方 UA 只有达到最低版本时才可原样透传，否则调用方应回退默认身份。
pub fn supported_official_user_agent(user_agent: &str) -> Option<&str> {
    let user_agent = user_agent.trim();
    official_originator_from_user_agent(user_agent)?;
    let version = user_agent
        .split_ascii_whitespace()
        .next()?
        .split_once('/')?
        .1;
    (enforce_minimum_client_version(version) == version).then_some(user_agent)
}

/// originator 必须与最终 UA 的客户端家族一致，避免上游按冲突指纹返回 404。
pub fn official_originator_from_user_agent(user_agent: &str) -> Option<&str> {
    let originator = user_agent
        .trim()
        .split_ascii_whitespace()
        .next()?
        .split_once('/')?
        .0;
    is_official_originator(originator).then_some(originator)
}

pub fn is_official_originator(originator: &str) -> bool {
    let originator = originator.trim().to_ascii_lowercase();
    originator.starts_with("codex_")
        || originator.starts_with("codex-")
        || originator.starts_with("codex ")
}

fn parse_version(version: &str) -> Option<[u64; 3]> {
    let mut parts = version.split('-').next()?.split('.');
    let parsed = [
        parts.next()?.parse().ok()?,
        parts.next()?.parse().ok()?,
        parts.next()?.parse().ok()?,
    ];
    parts.next().is_none().then_some(parsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn minimum_version_enforcement_accepts_supported_versions() {
        assert_eq!(enforce_minimum_client_version("0.144.0"), "0.144.0");
        assert_eq!(enforce_minimum_client_version("0.145.0"), "0.145.0");
    }

    #[test]
    fn minimum_version_enforcement_replaces_old_or_invalid_versions() {
        assert_eq!(enforce_minimum_client_version("0.143.9"), CLIENT_VERSION);
        assert_eq!(enforce_minimum_client_version("invalid"), CLIENT_VERSION);
    }
}
