use std::{collections::HashSet, error::Error as _};

use axum::http::StatusCode;
use url::Url;

use super::utils::is_retryable_transport_error_message;

const MAX_SOURCE_CHAIN_LAYERS: usize = 8;
const MAX_DIAGNOSTIC_BYTES: usize = 2048;
const TRUNCATED_SUFFIX: &str = "... [truncated]";
const EMBEDDED_URL_SCHEMES: &[&str] = &[
    "https://",
    "http://",
    "socks5h://",
    "socks5://",
    "wss://",
    "ws://",
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum TransportRecovery {
    Fatal,
    NextUpstream,
    SameUpstreamOnce,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum TransportErrorClass {
    Builder,
    Body,
    Decode,
    Redirect,
    Status,
    Connect,
    ProxyTransport,
    Timeout,
    Request,
    Other,
}

impl TransportErrorClass {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Builder => "builder",
            Self::Body => "body",
            Self::Decode => "decode",
            Self::Redirect => "redirect",
            Self::Status => "status",
            Self::Connect => "connect",
            Self::ProxyTransport => "proxy_transport",
            Self::Timeout => "timeout",
            Self::Request => "request",
            Self::Other => "other",
        }
    }
}

impl TransportRecovery {
    pub(super) fn as_str(self) -> &'static str {
        match self {
            Self::Fatal => "fatal",
            Self::NextUpstream => "next_upstream",
            Self::SameUpstreamOnce => "same_upstream_once",
        }
    }
}

#[derive(Debug)]
pub(super) struct TransportFailure {
    pub(super) class: TransportErrorClass,
    pub(super) client_message: String,
    pub(super) diagnostic_message: String,
    pub(super) status: StatusCode,
    pub(super) recovery: TransportRecovery,
    pub(super) is_timeout: bool,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
struct ErrorPredicates {
    builder: bool,
    request: bool,
    connect: bool,
    body: bool,
    decode: bool,
    redirect: bool,
    status: bool,
    timeout: bool,
}

impl ErrorPredicates {
    fn from_error(error: &reqwest::Error) -> Self {
        Self {
            builder: error.is_builder(),
            request: error.is_request(),
            connect: error.is_connect(),
            body: error.is_body(),
            decode: error.is_decode(),
            redirect: error.is_redirect(),
            status: error.is_status(),
            timeout: error.is_timeout(),
        }
    }

    fn diagnostic(self) -> String {
        format!(
            "builder={},request={},connect={},body={},decode={},redirect={},status={},timeout={}",
            self.builder,
            self.request,
            self.connect,
            self.body,
            self.decode,
            self.redirect,
            self.status,
            self.timeout
        )
    }
}

/// 只在 `.send()` 失败 seam 调用。普通 upstream 允许响应头前重放一次；
/// 已有内部恢复链的 caller 可改走下一 upstream。本地构造与响应处理错误始终禁止重放。
pub(super) fn analyze_transport_error(
    provider: &str,
    error: reqwest::Error,
    request_recovery: TransportRecovery,
) -> TransportFailure {
    let predicates = ErrorPredicates::from_error(&error);
    let source_chain = sanitized_source_chain(&error);
    let has_proxy_marker = source_chain_has_next_upstream_marker(&source_chain);
    let (class, recovery) = classify_error(predicates, has_proxy_marker, request_recovery);
    let status = if predicates.timeout {
        StatusCode::GATEWAY_TIMEOUT
    } else {
        StatusCode::BAD_GATEWAY
    };
    let diagnostic_message =
        format_diagnostic(provider, class, recovery, status, predicates, &source_chain);

    // `without_url` 是客户端消息的硬门禁；再次扫描可覆盖底层 message 嵌入的 URL。
    let client_message = sanitize_embedded_urls(&error.without_url().to_string());

    TransportFailure {
        class,
        client_message,
        diagnostic_message,
        status,
        recovery,
        is_timeout: predicates.timeout,
    }
}

fn classify_error(
    predicates: ErrorPredicates,
    has_proxy_marker: bool,
    request_recovery: TransportRecovery,
) -> (TransportErrorClass, TransportRecovery) {
    let fatal_class = if predicates.builder {
        Some(TransportErrorClass::Builder)
    } else if predicates.body {
        Some(TransportErrorClass::Body)
    } else if predicates.decode {
        Some(TransportErrorClass::Decode)
    } else if predicates.redirect {
        Some(TransportErrorClass::Redirect)
    } else if predicates.status {
        Some(TransportErrorClass::Status)
    } else {
        None
    };
    if let Some(class) = fatal_class {
        return (class, TransportRecovery::Fatal);
    }
    if predicates.connect {
        return (
            TransportErrorClass::Connect,
            TransportRecovery::NextUpstream,
        );
    }
    if has_proxy_marker {
        return (
            TransportErrorClass::ProxyTransport,
            TransportRecovery::NextUpstream,
        );
    }
    if predicates.timeout {
        return (TransportErrorClass::Timeout, request_recovery);
    }
    if predicates.request {
        return (TransportErrorClass::Request, request_recovery);
    }
    (TransportErrorClass::Other, TransportRecovery::Fatal)
}

fn sanitized_source_chain(error: &reqwest::Error) -> Vec<String> {
    let mut messages = vec![error.to_string()];
    let mut source = error.source();
    while messages.len() < MAX_SOURCE_CHAIN_LAYERS {
        let Some(cause) = source else {
            break;
        };
        messages.push(cause.to_string());
        source = cause.source();
    }
    sanitize_and_deduplicate(messages)
}

fn sanitize_and_deduplicate(messages: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for message in messages {
        let sanitized = sanitize_embedded_urls(message.trim());
        if sanitized.is_empty() || !seen.insert(sanitized.clone()) {
            continue;
        }
        unique.push(sanitized);
        if unique.len() == MAX_SOURCE_CHAIN_LAYERS {
            break;
        }
    }
    unique
}

fn source_chain_has_next_upstream_marker(source_chain: &[String]) -> bool {
    source_chain
        .iter()
        .any(|message| is_retryable_transport_error_message(message))
}

fn format_diagnostic(
    provider: &str,
    class: TransportErrorClass,
    recovery: TransportRecovery,
    status: StatusCode,
    predicates: ErrorPredicates,
    source_chain: &[String],
) -> String {
    let provider = sanitize_embedded_urls(provider);
    let source_chain = source_chain
        .iter()
        .enumerate()
        .map(|(index, message)| format!("{index}:{message}"))
        .collect::<Vec<_>>()
        .join(" <- ");
    let diagnostic = format!(
        "provider={provider}; class={}; recovery={}; status={}; predicates={}; source_chain={source_chain}",
        class.as_str(),
        recovery.as_str(),
        status.as_u16(),
        predicates.diagnostic(),
    );
    truncate_utf8(&diagnostic, MAX_DIAGNOSTIC_BYTES)
}

fn sanitize_embedded_urls(message: &str) -> String {
    let lowercase = message.to_ascii_lowercase();
    let mut output = String::with_capacity(message.len());
    let mut cursor = 0;

    while let Some(relative_start) = find_next_url_start(&lowercase[cursor..]) {
        let start = cursor + relative_start;
        output.push_str(&message[cursor..start]);
        let end = find_url_end(message, start);
        let raw = &message[start..end];
        let core_end = trim_url_trailing_punctuation(raw);
        let (candidate, trailing) = raw.split_at(core_end);

        match Url::parse(candidate) {
            Ok(mut parsed) => {
                redact_url_secrets(&mut parsed);
                output.push_str(parsed.as_str());
            }
            // diagnostic 会进入 tracing/SQLite；解析失败时必须闭合脱敏，不能回写潜在 userinfo。
            Err(_) => output.push_str("[redacted-url]"),
        }
        output.push_str(trailing);
        cursor = end;
    }

    output.push_str(&message[cursor..]);
    output
}

fn find_next_url_start(message: &str) -> Option<usize> {
    EMBEDDED_URL_SCHEMES
        .iter()
        .filter_map(|scheme| message.find(scheme))
        .min()
}

fn find_url_end(message: &str, start: usize) -> usize {
    message[start..]
        .char_indices()
        .find_map(|(offset, character)| {
            (character.is_whitespace()
                || character.is_control()
                || matches!(character, '\'' | '"' | '<' | '>'))
            .then_some(start + offset)
        })
        .unwrap_or(message.len())
}

fn trim_url_trailing_punctuation(candidate: &str) -> usize {
    let mut end = candidate.len();
    while end > 0 {
        let Some(character) = candidate[..end].chars().next_back() else {
            break;
        };
        if character == ']' && has_balanced_square_brackets(&candidate[..end]) {
            break;
        }
        if !matches!(character, '.' | ',' | ';' | ':' | ')' | ']' | '}') {
            break;
        }
        end -= character.len_utf8();
    }
    end
}

fn has_balanced_square_brackets(value: &str) -> bool {
    let opening = value.bytes().filter(|byte| *byte == b'[').count();
    let closing = value.bytes().filter(|byte| *byte == b']').count();
    opening > 0 && opening == closing
}

fn redact_url_secrets(url: &mut Url) {
    if !url.username().is_empty() {
        let _ = url.set_username("redacted");
    }
    if url.password().is_some() {
        let _ = url.set_password(Some("redacted"));
    }
    if url.query().is_some() {
        url.set_query(Some("redacted"));
    }
    if url.fragment().is_some() {
        url.set_fragment(Some("redacted"));
    }
}

fn truncate_utf8(value: &str, max_bytes: usize) -> String {
    if value.len() <= max_bytes {
        return value.to_string();
    }
    let content_limit = max_bytes.saturating_sub(TRUNCATED_SUFFIX.len());
    let mut end = content_limit.min(value.len());
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}{}", &value[..end], TRUNCATED_SUFFIX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_url_secrets_are_structurally_redacted() {
        let message = "send https://alice:super-secret@example.com/v1/responses?api_key=secret&model=gpt#token failed; proxy socks5://bob:proxy-secret@127.0.0.1:1080?token=secret.";

        let sanitized = sanitize_embedded_urls(message);

        assert!(!sanitized.contains("alice"));
        assert!(!sanitized.contains("super-secret"));
        assert!(!sanitized.contains("api_key"));
        assert!(!sanitized.contains("proxy-secret"));
        assert!(!sanitized.contains("token=secret"));
        assert!(sanitized
            .contains("https://redacted:redacted@example.com/v1/responses?redacted#redacted"));
        assert!(sanitized.contains("socks5://redacted:redacted@127.0.0.1:1080"));
        assert!(sanitized.contains("?redacted"));
    }

    #[test]
    fn ipv6_and_malformed_url_secrets_fail_closed() {
        let message = "IPv6 https://alice:ipv6-secret@[2001:db8::1] malformed https://bob:malformed-secret@[broken";

        let sanitized = sanitize_embedded_urls(message);

        assert!(!sanitized.contains("alice"));
        assert!(!sanitized.contains("ipv6-secret"));
        assert!(!sanitized.contains("bob"));
        assert!(!sanitized.contains("malformed-secret"));
        assert!(sanitized.contains("[2001:db8::1]"));
        assert!(sanitized.contains("[redacted-url]"));
    }

    #[test]
    fn diagnostic_is_utf8_safe_and_bounded() {
        let source_chain = (0..MAX_SOURCE_CHAIN_LAYERS)
            .map(|index| format!("layer-{index}:{}", "错误".repeat(600)))
            .collect::<Vec<_>>();

        let diagnostic = format_diagnostic(
            "openai-response",
            TransportErrorClass::Request,
            TransportRecovery::SameUpstreamOnce,
            StatusCode::BAD_GATEWAY,
            ErrorPredicates {
                request: true,
                ..ErrorPredicates::default()
            },
            &source_chain,
        );

        assert!(diagnostic.len() <= MAX_DIAGNOSTIC_BYTES);
        assert!(diagnostic.ends_with(TRUNCATED_SUFFIX));
    }

    #[test]
    fn source_chain_messages_are_sanitized_and_deduplicated() {
        let messages = vec![
            "same failure".to_string(),
            "same failure".to_string(),
            "https://user:password@example.com/path?secret=value".to_string(),
            "https://another:credential@example.com/path?other=value".to_string(),
        ];

        let unique = sanitize_and_deduplicate(messages);

        assert_eq!(unique.len(), 2);
        assert_eq!(unique[0], "same failure");
        assert_eq!(
            unique[1],
            "https://redacted:redacted@example.com/path?redacted"
        );
    }

    #[test]
    fn classification_preserves_fatal_and_recovery_precedence() {
        let builder_request = ErrorPredicates {
            builder: true,
            request: true,
            ..ErrorPredicates::default()
        };
        let connect_request = ErrorPredicates {
            connect: true,
            request: true,
            ..ErrorPredicates::default()
        };
        let request = ErrorPredicates {
            request: true,
            ..ErrorPredicates::default()
        };

        assert_eq!(
            classify_error(builder_request, true, TransportRecovery::SameUpstreamOnce,),
            (TransportErrorClass::Builder, TransportRecovery::Fatal)
        );
        assert_eq!(
            classify_error(connect_request, false, TransportRecovery::SameUpstreamOnce,),
            (
                TransportErrorClass::Connect,
                TransportRecovery::NextUpstream
            )
        );
        assert_eq!(
            classify_error(request, false, TransportRecovery::SameUpstreamOnce),
            (
                TransportErrorClass::Request,
                TransportRecovery::SameUpstreamOnce
            )
        );
        assert_eq!(
            classify_error(request, false, TransportRecovery::NextUpstream),
            (
                TransportErrorClass::Request,
                TransportRecovery::NextUpstream
            )
        );
    }

    #[test]
    fn h2_reset_before_headers_is_replayable_once() {
        tokio::runtime::Runtime::new()
            .expect("create H2 test runtime")
            .block_on(async {
                let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
                    .await
                    .expect("bind H2 reset server");
                let address = listener.local_addr().expect("H2 reset server address");
                let server = tokio::spawn(async move {
                    let (socket, _) = listener.accept().await.expect("accept H2 client");
                    let mut connection = h2::server::handshake(socket)
                        .await
                        .expect("complete H2 handshake");
                    let (_, mut respond) = connection
                        .accept()
                        .await
                        .expect("receive H2 request")
                        .expect("valid H2 request");
                    // 在任何响应头前 reset stream，复现共享 H2 session 的 request-kind 错误。
                    respond.send_reset(h2::Reason::INTERNAL_ERROR);
                    // 不阻塞等待更多 accept；drop connection 结束会话。
                    drop(connection);
                });
                let client = reqwest::Client::builder()
                    .http2_prior_knowledge()
                    // keep-alive 会让本测试在 idle 连接上挂住；显式关掉。
                    .pool_max_idle_per_host(0)
                    .build()
                    .expect("build H2 client");
                let error = tokio::time::timeout(
                    std::time::Duration::from_secs(5),
                    client
                        .post(format!("http://{address}/v1/responses?token=secret"))
                        .body("{}")
                        .send(),
                )
                .await
                .expect("H2 reset client must finish within 5s")
                .expect_err("H2 reset must fail before headers");

                let failure = analyze_transport_error(
                    "openai-response",
                    error,
                    TransportRecovery::SameUpstreamOnce,
                );
                let _ = tokio::time::timeout(std::time::Duration::from_secs(2), server).await;

                assert_eq!(failure.class, TransportErrorClass::Request);
                assert_eq!(failure.recovery, TransportRecovery::SameUpstreamOnce);
                assert_eq!(failure.status, StatusCode::BAD_GATEWAY);
                assert!(!failure.client_message.contains("secret"));
                assert!(!failure.diagnostic_message.contains("token=secret"));
                assert!(failure.diagnostic_message.contains("source_chain="));
            });
    }
}
