use reqwest::{redirect::Policy, Client, Proxy};
use serde::Deserialize;
use std::time::Duration;
use url::Url;

use super::error::XaiOAuthError;

const DISCOVERY_URL: &str = "https://auth.x.ai/.well-known/openid-configuration";
const CLIENT_ID: &str = "b1a00492-073a-47ea-816f-4c329264a828";
const SCOPE: &str = "openid profile email offline_access grok-cli:access api:access";
const DEVICE_CODE_GRANT_TYPE: &str = "urn:ietf:params:oauth:grant-type:device_code";

#[derive(Clone, Debug, Deserialize)]
struct XaiDiscovery {
    device_authorization_endpoint: String,
    token_endpoint: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct XaiDeviceCode {
    pub(crate) device_code: String,
    pub(crate) user_code: String,
    pub(crate) verification_uri: String,
    pub(crate) verification_uri_complete: Option<String>,
    pub(crate) expires_in: i64,
    #[serde(default = "default_poll_interval")]
    pub(crate) interval: u64,
    #[serde(skip)]
    pub(crate) token_endpoint: String,
}

#[derive(Clone, Debug, Deserialize)]
pub(crate) struct XaiTokenResponse {
    pub(crate) access_token: String,
    #[serde(default)]
    pub(crate) refresh_token: String,
    #[serde(default)]
    pub(crate) id_token: String,
    #[serde(default)]
    pub(crate) token_type: String,
    #[serde(default = "default_expires_in")]
    pub(crate) expires_in: i64,
}

pub(crate) enum XaiDevicePoll {
    Pending,
    SlowDown,
    Authorized(XaiTokenResponse),
}

#[derive(Clone)]
pub(crate) struct XaiOAuthClient {
    http: Client,
    discovery_url: String,
}

impl XaiOAuthClient {
    pub(crate) fn new(proxy_url: Option<&str>) -> Result<Self, String> {
        let http = build_oauth_http_client(proxy_url)?;
        Ok(Self {
            http,
            discovery_url: DISCOVERY_URL.to_string(),
        })
    }

    #[cfg(test)]
    pub(crate) fn with_discovery_url(
        proxy_url: Option<&str>,
        discovery_url: &str,
    ) -> Result<Self, String> {
        let mut client = Self::new(proxy_url)?;
        client.discovery_url = validate_oauth_endpoint(discovery_url, "discovery_url")
            .map_err(|error| error.to_string())?;
        Ok(client)
    }

    pub(crate) async fn start_device_flow(&self) -> Result<XaiDeviceCode, XaiOAuthError> {
        let discovery = self.discover().await?;
        let form = [("client_id", CLIENT_ID), ("scope", SCOPE)];
        tracing::debug!("xai device authorization request start");
        let response = self
            .http
            .post(&discovery.device_authorization_endpoint)
            .header("Accept", "application/json")
            .form(&form)
            .send()
            .await
            .map_err(|error| XaiOAuthError::request("device authorization request", error))?;
        let status = response.status();
        let bytes = response
            .bytes()
            .await
            .map_err(|error| XaiOAuthError::request("device authorization response", error))?;
        if !status.is_success() {
            return Err(XaiOAuthError::response(status.as_u16(), &bytes));
        }
        let mut device = serde_json::from_slice::<XaiDeviceCode>(&bytes)
            .map_err(|_| XaiOAuthError::invalid("Invalid xAI device authorization response."))?;
        validate_device_code(&mut device)?;
        device.token_endpoint = discovery.token_endpoint;
        Ok(device)
    }

    pub(crate) async fn poll_device_code(
        &self,
        device: &XaiDeviceCode,
    ) -> Result<XaiDevicePoll, XaiOAuthError> {
        let token_endpoint = validate_oauth_endpoint(&device.token_endpoint, "token_endpoint")?;
        let form = [
            ("grant_type", DEVICE_CODE_GRANT_TYPE),
            ("device_code", device.device_code.as_str()),
            ("client_id", CLIENT_ID),
        ];
        let response = self
            .http
            .post(token_endpoint)
            .header("Accept", "application/json")
            .form(&form)
            .send()
            .await
            .map_err(|error| XaiOAuthError::request("device token request", error))?;
        let status = response.status();
        let bytes = response
            .bytes()
            .await
            .map_err(|error| XaiOAuthError::request("device token response", error))?;

        if let Ok(payload) = serde_json::from_slice::<DeviceTokenPayload>(&bytes) {
            match payload.error.as_deref() {
                Some("authorization_pending") => return Ok(XaiDevicePoll::Pending),
                Some("slow_down") => return Ok(XaiDevicePoll::SlowDown),
                Some("expired_token") => {
                    return Err(XaiOAuthError::invalid("xAI device code expired."));
                }
                Some("access_denied") => {
                    return Err(XaiOAuthError::invalid("xAI device authorization denied."));
                }
                Some(_) => return Err(XaiOAuthError::response(status.as_u16(), &bytes)),
                None => {}
            }
        }
        if !status.is_success() {
            return Err(XaiOAuthError::response(status.as_u16(), &bytes));
        }
        let token = parse_token_response(&bytes)?;
        Ok(XaiDevicePoll::Authorized(token))
    }

    pub(crate) async fn refresh_token(
        &self,
        refresh_token: &str,
        token_endpoint: Option<&str>,
    ) -> Result<XaiTokenResponse, XaiOAuthError> {
        let token_endpoint = match token_endpoint
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            Some(endpoint) => validate_oauth_endpoint(endpoint, "token_endpoint")?,
            None => self.discover().await?.token_endpoint,
        };
        let form = [
            ("grant_type", "refresh_token"),
            ("client_id", CLIENT_ID),
            ("refresh_token", refresh_token.trim()),
        ];
        tracing::debug!("xai refresh token exchange start");
        let response = self
            .http
            .post(token_endpoint)
            .header("Accept", "application/json")
            .form(&form)
            .send()
            .await
            .map_err(|error| XaiOAuthError::request("refresh request", error))?;
        let status = response.status();
        let bytes = response
            .bytes()
            .await
            .map_err(|error| XaiOAuthError::request("refresh response", error))?;
        if !status.is_success() {
            return Err(XaiOAuthError::response(status.as_u16(), &bytes));
        }
        parse_token_response(&bytes)
    }

    async fn discover(&self) -> Result<XaiDiscovery, XaiOAuthError> {
        tracing::debug!("xai oidc discovery request start");
        let response = self
            .http
            .get(&self.discovery_url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|error| XaiOAuthError::request("discovery request", error))?;
        let status = response.status();
        let bytes = response
            .bytes()
            .await
            .map_err(|error| XaiOAuthError::request("discovery response", error))?;
        if !status.is_success() {
            return Err(XaiOAuthError::response(status.as_u16(), &bytes));
        }
        let mut discovery = serde_json::from_slice::<XaiDiscovery>(&bytes)
            .map_err(|_| XaiOAuthError::invalid("Invalid xAI OIDC discovery response."))?;
        discovery.device_authorization_endpoint = validate_oauth_endpoint(
            &discovery.device_authorization_endpoint,
            "device_authorization_endpoint",
        )?;
        discovery.token_endpoint =
            validate_oauth_endpoint(&discovery.token_endpoint, "token_endpoint")?;
        Ok(discovery)
    }
}

fn build_oauth_http_client(proxy_url: Option<&str>) -> Result<Client, String> {
    // OAuth POST bodies contain credentials, so redirects must never replay them to another host.
    let mut builder = Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(Policy::none());
    if let Some(proxy_url) = proxy_url.map(str::trim).filter(|value| !value.is_empty()) {
        let proxy =
            Proxy::all(proxy_url).map_err(|_| "app_proxy_url is not a valid URL.".to_string())?;
        // An explicit app proxy replaces reqwest's system proxy discovery.
        builder = builder.proxy(proxy);
    }
    let client = builder
        .build()
        .map_err(|error| format!("Failed to build xAI OAuth client: {error}"))?;
    tracing::debug!("xai oauth client redirects disabled");
    Ok(client)
}

pub(crate) fn validate_oauth_endpoint(raw_url: &str, field: &str) -> Result<String, XaiOAuthError> {
    let raw_url = raw_url.trim();
    let parsed = Url::parse(raw_url)
        .map_err(|_| XaiOAuthError::invalid(format!("xAI {field} is not a valid URL.")))?;
    let host = parsed.host_str().unwrap_or_default().to_ascii_lowercase();
    if parsed.scheme() != "https"
        || has_userinfo(raw_url, &parsed)
        || (host != "x.ai" && !host.ends_with(".x.ai"))
    {
        return Err(XaiOAuthError::invalid(format!(
            "xAI {field} must use a trusted x.ai HTTPS URL without userinfo."
        )));
    }
    Ok(parsed.to_string())
}

fn has_userinfo(raw_url: &str, parsed: &Url) -> bool {
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return true;
    }
    // url::Url 会丢弃空 userinfo；必须从原始 authority 检查 `https://@host`。
    raw_url
        .split_once("://")
        .map(|(_, remainder)| {
            remainder
                .split(['/', '?', '#'])
                .next()
                .unwrap_or_default()
                .contains('@')
        })
        .unwrap_or(false)
}

fn validate_device_code(device: &mut XaiDeviceCode) -> Result<(), XaiOAuthError> {
    if device.device_code.trim().is_empty()
        || device.user_code.trim().is_empty()
        || device.verification_uri.trim().is_empty()
    {
        return Err(XaiOAuthError::invalid(
            "xAI device authorization response is incomplete.",
        ));
    }
    device.verification_uri =
        validate_oauth_endpoint(&device.verification_uri, "verification_uri")?;
    device.verification_uri_complete = match device
        .verification_uri_complete
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(value) => Some(validate_oauth_endpoint(value, "verification_uri_complete")?),
        None => None,
    };
    Ok(())
}

fn parse_token_response(bytes: &[u8]) -> Result<XaiTokenResponse, XaiOAuthError> {
    let token = serde_json::from_slice::<XaiTokenResponse>(bytes)
        .map_err(|_| XaiOAuthError::invalid("Invalid xAI OAuth token response."))?;
    if token.access_token.trim().is_empty() {
        return Err(XaiOAuthError::invalid(
            "xAI OAuth token response is missing access_token.",
        ));
    }
    Ok(token)
}

fn default_poll_interval() -> u64 {
    5
}

fn default_expires_in() -> i64 {
    3600
}

#[derive(Deserialize)]
struct DeviceTokenPayload {
    error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{header::LOCATION, StatusCode};
    use axum::{routing::post, Router};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use tokio::net::TcpListener;

    #[test]
    fn oauth_endpoint_requires_trusted_https_host() {
        assert!(validate_oauth_endpoint("https://auth.x.ai/oauth2/token", "token").is_ok());
        assert!(validate_oauth_endpoint("https://nested.auth.x.ai/token", "token").is_ok());
        assert!(validate_oauth_endpoint("http://auth.x.ai/token", "token").is_err());
        assert!(validate_oauth_endpoint("https://x.ai.evil.example/token", "token").is_err());
        assert!(validate_oauth_endpoint("https://user:secret@auth.x.ai/token", "token").is_err());
        assert!(validate_oauth_endpoint("https://@auth.x.ai/token", "token").is_err());
    }

    #[test]
    fn device_code_requires_trusted_verification_uris() {
        let mut device = test_device_code(
            "https://auth.x.ai/activate",
            Some("https://auth.x.ai/activate?user_code=ABCD-EFGH"),
        );
        validate_device_code(&mut device).expect("trusted verification URIs");

        let mut untrusted = test_device_code("https://example.com/activate", None);
        assert!(validate_device_code(&mut untrusted).is_err());

        let mut userinfo = test_device_code("https://user:secret@auth.x.ai/activate", None);
        let error = validate_device_code(&mut userinfo)
            .expect_err("verification URI userinfo must be rejected")
            .to_string();
        assert!(!error.contains("secret"));

        let mut untrusted_complete = test_device_code(
            "https://auth.x.ai/activate",
            Some("https://example.com/activate?user_code=ABCD-EFGH"),
        );
        assert!(validate_device_code(&mut untrusted_complete).is_err());
    }

    #[test]
    fn token_response_requires_access_token() {
        assert!(parse_token_response(br#"{"refresh_token":"refresh"}"#).is_err());
        let token = parse_token_response(br#"{"access_token":"access"}"#).unwrap();
        assert_eq!(token.expires_in, 3600);
    }

    #[tokio::test]
    async fn oauth_client_does_not_replay_sensitive_post_on_307_or_308() {
        for redirect_status in [
            StatusCode::TEMPORARY_REDIRECT,
            StatusCode::PERMANENT_REDIRECT,
        ] {
            assert_sensitive_post_is_not_replayed(redirect_status).await;
        }
    }

    async fn assert_sensitive_post_is_not_replayed(redirect_status: StatusCode) {
        let sink_hits = Arc::new(AtomicUsize::new(0));
        let sink_hits_for_route = Arc::clone(&sink_hits);
        let app = Router::new()
            .route(
                "/oauth",
                post(move || async move { (redirect_status, [(LOCATION, "/sink")]) }),
            )
            .route(
                "/sink",
                post(move || async move {
                    sink_hits_for_route.fetch_add(1, Ordering::SeqCst);
                    StatusCode::NO_CONTENT
                }),
            );
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        let client = XaiOAuthClient::with_discovery_url(None, DISCOVERY_URL).unwrap();
        let response = client
            .http
            .post(format!("http://{address}/oauth"))
            .form(&[("refresh_token", "sensitive-refresh-token")])
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), redirect_status);
        tokio::task::yield_now().await;
        assert_eq!(sink_hits.load(Ordering::SeqCst), 0);
        server.abort();
    }

    fn test_device_code(
        verification_uri: &str,
        verification_uri_complete: Option<&str>,
    ) -> XaiDeviceCode {
        XaiDeviceCode {
            device_code: "device-code".to_string(),
            user_code: "ABCD-EFGH".to_string(),
            verification_uri: verification_uri.to_string(),
            verification_uri_complete: verification_uri_complete.map(str::to_string),
            expires_in: 600,
            interval: 5,
            token_endpoint: String::new(),
        }
    }
}
