use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::SqlitePool;
use std::{
    sync::{Arc, Mutex},
    time::{Instant, SystemTime, UNIX_EPOCH},
};

use super::pricing::{calculate_request_cost, default_model_pricing_settings, BillableUsage};

#[cfg(debug_assertions)]
macro_rules! debug_log_error {
    ($($arg:tt)*) => {
        eprintln!($($arg)*);
    };
}

#[cfg(not(debug_assertions))]
macro_rules! debug_log_error {
    ($($arg:tt)*) => {};
}

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct TokenUsage {
    pub(crate) input_tokens: Option<u64>,
    pub(crate) output_tokens: Option<u64>,
    pub(crate) total_tokens: Option<u64>,
}

#[derive(Clone, Default, Serialize, Deserialize)]
pub(crate) struct UsageSnapshot {
    pub(crate) usage: Option<TokenUsage>,
    pub(crate) billable_usage: BillableUsage,
    pub(crate) service_tier: Option<String>,
    pub(crate) usage_json: Option<Value>,
}

impl UsageSnapshot {
    pub(crate) fn from_uncached_usage(
        usage: Option<TokenUsage>,
        usage_json: Option<Value>,
    ) -> Self {
        let billable_usage = usage
            .as_ref()
            .map(|usage| BillableUsage {
                uncached_input_tokens: usage.input_tokens.unwrap_or(0),
                output_tokens: usage.output_tokens.unwrap_or(0),
                ..BillableUsage::default()
            })
            .unwrap_or_default();
        Self {
            usage,
            billable_usage,
            service_tier: None,
            usage_json,
        }
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.usage.is_none()
            && self.billable_usage == BillableUsage::default()
            && self.usage_json.is_none()
    }
}

#[derive(Serialize, Deserialize)]
pub(crate) struct LogEntry {
    pub(crate) ts_ms: u128,
    pub(crate) client_ip: Option<String>,
    pub(crate) path: String,
    pub(crate) provider: String,
    pub(crate) upstream_id: String,
    pub(crate) account_id: Option<String>,
    pub(crate) model: Option<String>,
    pub(crate) mapped_model: Option<String>,
    pub(crate) stream: bool,
    pub(crate) status: u16,
    pub(crate) usage: Option<TokenUsage>,
    pub(crate) billable_usage: BillableUsage,
    pub(crate) service_tier: Option<String>,
    pub(crate) usage_json: Option<Value>,
    pub(crate) upstream_request_id: Option<String>,
    pub(crate) request_headers: Option<String>,
    pub(crate) request_body: Option<String>,
    pub(crate) response_body: Option<String>,
    pub(crate) response_error: Option<String>,
    pub(crate) latency_ms: u128,
    pub(crate) upstream_first_byte_ms: Option<u128>,
    pub(crate) upstream_response_headers_ms: Option<u128>,
    pub(crate) upstream_first_body_chunk_ms: Option<u128>,
    pub(crate) first_client_flush_ms: Option<u128>,
    pub(crate) first_output_ms: Option<u128>,
    pub(crate) cost_nano_usd: Option<u64>,
    pub(crate) pricing_version: String,
    pub(crate) pricing_model: Option<String>,
    pub(crate) pricing_context_tier: Option<String>,
}

#[derive(Clone, Copy, Default)]
pub(crate) struct RequestTimingSnapshot {
    pub(crate) upstream_first_byte_ms: Option<u128>,
    pub(crate) upstream_response_headers_ms: Option<u128>,
    pub(crate) upstream_first_body_chunk_ms: Option<u128>,
    pub(crate) first_client_flush_ms: Option<u128>,
    pub(crate) first_output_ms: Option<u128>,
}

#[derive(Clone, Default)]
pub(crate) struct RequestTimings {
    inner: Arc<Mutex<RequestTimingSnapshot>>,
}

impl RequestTimings {
    pub(crate) fn mark_upstream_response_headers(&self, value: u128) {
        self.mark_once(|snapshot| &mut snapshot.upstream_response_headers_ms, value);
    }

    pub(crate) fn mark_upstream_first_body_chunk(&self, value: u128) {
        self.mark_once(|snapshot| &mut snapshot.upstream_first_body_chunk_ms, value);
        self.mark_once(|snapshot| &mut snapshot.upstream_first_byte_ms, value);
    }

    fn mark_upstream_first_byte(&self, value: u128) {
        self.mark_upstream_first_body_chunk(value);
    }

    fn mark_first_client_flush(&self, value: u128) {
        self.mark_once(|snapshot| &mut snapshot.first_client_flush_ms, value);
    }

    fn mark_first_output(&self, value: u128) {
        self.mark_once(|snapshot| &mut snapshot.first_output_ms, value);
    }

    fn snapshot(&self) -> RequestTimingSnapshot {
        self.inner.lock().map(|guard| *guard).unwrap_or_default()
    }

    fn mark_once(
        &self,
        select: impl FnOnce(&mut RequestTimingSnapshot) -> &mut Option<u128>,
        value: u128,
    ) {
        let Ok(mut guard) = self.inner.lock() else {
            return;
        };
        let slot = select(&mut guard);
        if slot.is_none() {
            *slot = Some(value);
        }
    }
}

#[derive(Clone)]
pub(crate) struct LogContext {
    pub(crate) client_ip: Option<String>,
    pub(crate) path: String,
    pub(crate) provider: String,
    pub(crate) upstream_id: String,
    pub(crate) account_id: Option<String>,
    pub(crate) model: Option<String>,
    pub(crate) mapped_model: Option<String>,
    pub(crate) stream: bool,
    pub(crate) status: u16,
    pub(crate) upstream_request_id: Option<String>,
    pub(crate) request_headers: Option<String>,
    pub(crate) request_body: Option<String>,
    // Legacy field name: this records first upstream body chunk, not response headers.
    pub(crate) ttfb_ms: Option<u128>,
    pub(crate) timings: RequestTimings,
    pub(crate) start: Instant,
}

impl LogContext {
    pub(crate) fn mark_upstream_first_byte(&mut self) {
        let value = self.start.elapsed().as_millis();
        if self.ttfb_ms.is_none() {
            self.ttfb_ms = Some(value);
        }
        self.timings.mark_upstream_first_byte(value);
    }

    pub(crate) fn mark_first_client_flush(&mut self) {
        self.timings
            .mark_first_client_flush(self.start.elapsed().as_millis());
    }

    pub(crate) fn mark_first_output(&mut self) {
        self.timings
            .mark_first_output(self.start.elapsed().as_millis());
    }

    pub(crate) fn timing_snapshot(&self) -> RequestTimingSnapshot {
        self.timings.snapshot()
    }
}

pub(crate) struct LogWriter {
    sqlite: Option<SqlitePool>,
}

impl LogWriter {
    pub(crate) fn new(sqlite: Option<SqlitePool>) -> Self {
        Self { sqlite }
    }

    // Fire-and-forget logging to avoid blocking the request path.
    pub(crate) fn write_detached(self: Arc<Self>, entry: LogEntry) {
        tokio::spawn(async move {
            self.write(&entry).await;
        });
    }

    pub(crate) async fn write(&self, entry: &LogEntry) {
        let Some(pool) = self.sqlite.as_ref() else {
            return;
        };
        if let Err(_err) = insert_log_entry(pool, entry).await {
            debug_log_error!("proxy sqlite write failed: {_err}");
        }
    }
}

pub(crate) fn build_log_entry(
    context: &LogContext,
    usage: UsageSnapshot,
    response_error: Option<String>,
) -> LogEntry {
    // 错误摘要用于本地排障，不随请求详情捕获开关关闭；完整响应体仍在 attach_response_body 里受控。
    let timing = context.timing_snapshot();
    let upstream_first_body_chunk_ms = timing
        .upstream_first_body_chunk_ms
        .or(timing.upstream_first_byte_ms)
        .or(context.ttfb_ms);
    let upstream_first_byte_ms = timing
        .upstream_first_byte_ms
        .or(upstream_first_body_chunk_ms);
    let latency_ms = timing
        .first_output_ms
        .or(timing.first_client_flush_ms)
        .or(upstream_first_body_chunk_ms)
        .or(timing.upstream_response_headers_ms)
        .unwrap_or_else(|| context.start.elapsed().as_millis());
    let service_tier = usage
        .service_tier
        .clone()
        .or_else(|| service_tier_from_request_body(context.request_body.as_deref()));
    let pricing_settings = default_model_pricing_settings();
    let request_cost = calculate_request_cost(
        &pricing_settings,
        context.model.as_deref(),
        context.mapped_model.as_deref(),
        service_tier.as_deref(),
        &usage.billable_usage,
    );
    LogEntry {
        ts_ms: now_ms(),
        client_ip: context.client_ip.clone(),
        path: context.path.clone(),
        provider: context.provider.clone(),
        upstream_id: context.upstream_id.clone(),
        account_id: context.account_id.clone(),
        model: context.model.clone(),
        mapped_model: context.mapped_model.clone(),
        stream: context.stream,
        status: context.status,
        usage: usage.usage,
        billable_usage: usage.billable_usage,
        service_tier,
        usage_json: usage.usage_json,
        upstream_request_id: context.upstream_request_id.clone(),
        request_headers: context.request_headers.clone(),
        request_body: context.request_body.clone(),
        response_body: None,
        response_error,
        latency_ms,
        upstream_first_byte_ms,
        upstream_response_headers_ms: timing.upstream_response_headers_ms,
        upstream_first_body_chunk_ms,
        first_client_flush_ms: timing.first_client_flush_ms,
        first_output_ms: timing.first_output_ms,
        cost_nano_usd: request_cost.as_ref().map(|cost| cost.cost_nano_usd),
        pricing_version: pricing_settings.version,
        pricing_model: request_cost.as_ref().map(|cost| cost.pricing_model.clone()),
        pricing_context_tier: request_cost
            .as_ref()
            .map(|cost| cost.context_tier.as_str().to_string()),
    }
}

pub(crate) fn attach_response_body(entry: &mut LogEntry, response_body: &str) {
    if !captures_request_detail(&entry.request_headers, &entry.request_body) {
        return;
    }
    if response_body.is_empty() {
        return;
    }
    entry.response_body = Some(response_body.to_string());
}

fn captures_request_detail(
    request_headers: &Option<String>,
    request_body: &Option<String>,
) -> bool {
    request_headers.is_some() || request_body.is_some()
}

fn service_tier_from_request_body(request_body: Option<&str>) -> Option<String> {
    let value = serde_json::from_str::<Value>(request_body?).ok()?;
    value
        .get("service_tier")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_ascii_lowercase)
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

async fn insert_log_entry(pool: &SqlitePool, entry: &LogEntry) -> Result<(), sqlx::Error> {
    let usage = entry.usage.as_ref();
    let input_tokens = usage.and_then(|usage| usage.input_tokens).map(to_i64_u64);
    let output_tokens = usage.and_then(|usage| usage.output_tokens).map(to_i64_u64);
    let total_tokens = usage.and_then(|usage| usage.total_tokens).map(to_i64_u64);
    let billable = &entry.billable_usage;
    let billable_value = |value| usage.map(|_| to_i64_u64(value));
    let pricing_settings = super::pricing::read_model_pricing_settings(pool)
        .await
        .unwrap_or_else(|_| default_model_pricing_settings());
    let request_cost = calculate_request_cost(
        &pricing_settings,
        entry.model.as_deref(),
        entry.mapped_model.as_deref(),
        entry.service_tier.as_deref(),
        billable,
    );
    let cost_nano_usd = request_cost
        .as_ref()
        .map(|cost| to_i64_u64(cost.cost_nano_usd));
    let pricing_model = request_cost
        .as_ref()
        .map(|cost| cost.pricing_model.as_str());
    let pricing_context_tier = request_cost.as_ref().map(|cost| cost.context_tier.as_str());
    let usage_json = entry.usage_json.as_ref().map(Value::to_string);

    sqlx::query(
        r#"
INSERT INTO request_logs (
  ts_ms,
  client_ip,
  path,
  provider,
  upstream_id,
  account_id,
  model,
  mapped_model,
  stream,
  status,
  input_tokens,
  output_tokens,
  total_tokens,
  uncached_input_tokens,
  cache_read_tokens,
  cache_write_tokens,
  cache_write_5m_tokens,
  cache_write_1h_tokens,
  image_input_tokens,
  image_output_tokens,
  service_tier,
  usage_json,
  upstream_request_id,
  request_headers,
  request_body,
  response_body,
  response_error,
  latency_ms,
  upstream_first_byte_ms,
  upstream_response_headers_ms,
  upstream_first_body_chunk_ms,
  first_client_flush_ms,
  first_output_ms,
  cost_nano_usd,
  pricing_version,
  pricing_model,
  pricing_context_tier
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
"#,
    )
    .bind(to_i64_u128(entry.ts_ms))
    .bind(entry.client_ip.as_deref())
    .bind(entry.path.as_str())
    .bind(entry.provider.as_str())
    .bind(entry.upstream_id.as_str())
    .bind(entry.account_id.as_deref())
    .bind(entry.model.as_deref())
    .bind(entry.mapped_model.as_deref())
    .bind(entry.stream)
    .bind(i64::from(entry.status))
    .bind(input_tokens)
    .bind(output_tokens)
    .bind(total_tokens)
    .bind(billable_value(billable.uncached_input_tokens))
    .bind(billable_value(billable.cache_read_tokens))
    .bind(billable_value(billable.cache_write_tokens))
    .bind(billable_value(billable.cache_write_5m_tokens))
    .bind(billable_value(billable.cache_write_1h_tokens))
    .bind(billable_value(billable.image_input_tokens))
    .bind(billable_value(billable.image_output_tokens))
    .bind(entry.service_tier.as_deref())
    .bind(usage_json.as_deref())
    .bind(entry.upstream_request_id.as_deref())
    .bind(entry.request_headers.as_deref())
    .bind(entry.request_body.as_deref())
    .bind(entry.response_body.as_deref())
    .bind(entry.response_error.as_deref())
    .bind(to_i64_u128(entry.latency_ms))
    .bind(entry.upstream_first_byte_ms.map(to_i64_u128))
    .bind(entry.upstream_response_headers_ms.map(to_i64_u128))
    .bind(entry.upstream_first_body_chunk_ms.map(to_i64_u128))
    .bind(entry.first_client_flush_ms.map(to_i64_u128))
    .bind(entry.first_output_ms.map(to_i64_u128))
    .bind(cost_nano_usd)
    .bind(pricing_settings.version.as_str())
    .bind(pricing_model)
    .bind(pricing_context_tier)
    .execute(pool)
    .await?;

    Ok(())
}

fn to_i64_u128(value: u128) -> i64 {
    value.min(i64::MAX as u128) as i64
}

fn to_i64_u64(value: u64) -> i64 {
    value.min(i64::MAX as u64) as i64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::proxy::pricing::{
        save_model_pricing_settings, BillableUsage, ModelPricingModel, ModelPricingProfile,
        ModelPricingSettingsInput,
    };
    use sqlx::{sqlite::SqlitePoolOptions, Row};
    use std::collections::BTreeMap;
    use std::time::{Duration, Instant};

    fn test_log_context(
        request_headers: Option<String>,
        request_body: Option<String>,
    ) -> LogContext {
        LogContext {
            client_ip: Some("203.0.113.9".to_string()),
            path: "/v1/responses".to_string(),
            provider: "openai-response".to_string(),
            upstream_id: "airouter".to_string(),
            account_id: None,
            model: Some("gpt-5.5".to_string()),
            mapped_model: None,
            stream: false,
            status: 500,
            upstream_request_id: None,
            request_headers,
            request_body,
            ttfb_ms: None,
            timings: RequestTimings::default(),
            start: Instant::now(),
        }
    }

    #[test]
    fn build_log_entry_keeps_response_error_when_detail_capture_is_off() {
        let context = test_log_context(None, None);

        let entry = build_log_entry(
            &context,
            UsageSnapshot::default(),
            Some("upstream secret".to_string()),
        );

        assert_eq!(entry.response_error.as_deref(), Some("upstream secret"));
        assert_eq!(entry.client_ip.as_deref(), Some("203.0.113.9"));
    }

    #[test]
    fn build_log_entry_keeps_response_error_when_detail_capture_is_on() {
        let context = test_log_context(Some("[]".to_string()), None);

        let entry = build_log_entry(
            &context,
            UsageSnapshot::default(),
            Some("upstream secret".to_string()),
        );

        assert_eq!(entry.response_error.as_deref(), Some("upstream secret"));
    }

    #[test]
    fn build_log_entry_keeps_response_headers_and_body_chunk_timings_separate() {
        let timings = RequestTimings::default();
        timings.mark_upstream_response_headers(25);
        timings.mark_upstream_first_body_chunk(120);
        timings.mark_upstream_first_byte(120);
        timings.mark_first_output(220);

        let context = LogContext {
            client_ip: None,
            path: "/v1/responses".to_string(),
            provider: "openai-response".to_string(),
            upstream_id: "airouter".to_string(),
            account_id: None,
            model: Some("gpt-5.5".to_string()),
            mapped_model: None,
            stream: true,
            status: 200,
            upstream_request_id: None,
            request_headers: None,
            request_body: None,
            ttfb_ms: None,
            timings,
            start: Instant::now() - Duration::from_millis(300),
        };

        let entry = build_log_entry(&context, UsageSnapshot::default(), None);

        assert_eq!(entry.upstream_response_headers_ms, Some(25));
        assert_eq!(entry.upstream_first_body_chunk_ms, Some(120));
        assert_eq!(entry.upstream_first_byte_ms, Some(120));
        assert_eq!(entry.first_output_ms, Some(220));
        assert_eq!(entry.latency_ms, 220);
    }

    #[test]
    fn build_log_entry_calculates_request_cost() {
        let context = LogContext {
            client_ip: None,
            path: "/v1/responses".to_string(),
            provider: "openai-response".to_string(),
            upstream_id: "airouter".to_string(),
            account_id: None,
            model: Some("alias".to_string()),
            mapped_model: Some("gpt-5.4".to_string()),
            stream: false,
            status: 200,
            upstream_request_id: None,
            request_headers: None,
            request_body: None,
            ttfb_ms: None,
            timings: RequestTimings::default(),
            start: Instant::now(),
        };

        let entry = build_log_entry(
            &context,
            UsageSnapshot {
                usage: Some(TokenUsage {
                    input_tokens: Some(1_000_000),
                    output_tokens: Some(10_000),
                    total_tokens: Some(1_010_000),
                }),
                billable_usage: BillableUsage {
                    uncached_input_tokens: 800_000,
                    cache_read_tokens: 200_000,
                    output_tokens: 10_000,
                    ..BillableUsage::default()
                },
                service_tier: None,
                usage_json: None,
            },
            None,
        );

        assert_eq!(entry.cost_nano_usd, Some(4_325_000_000));
        assert_eq!(entry.pricing_model.as_deref(), Some("gpt-5.4"));
        assert_eq!(entry.pricing_context_tier.as_deref(), Some("long"));
        assert_eq!(
            entry.pricing_version,
            default_model_pricing_settings().version
        );
    }

    #[tokio::test]
    async fn log_writer_uses_saved_model_pricing_settings() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect sqlite");
        crate::proxy::sqlite::init_schema(&pool)
            .await
            .expect("init sqlite");
        let snapshot = save_model_pricing_settings(
            &pool,
            ModelPricingSettingsInput {
                models: vec![ModelPricingModel {
                    model_id: "custom-model".to_string(),
                    aliases: vec!["openai/custom-model".to_string()],
                    price_multiplier_scaled: crate::proxy::pricing::PRICE_MULTIPLIER_SCALE,
                    standard: ModelPricingProfile {
                        input_nano_usd_per_token: Some(100),
                        cache_read_nano_usd_per_token: Some(10),
                        cache_write_nano_usd_per_token: Some(125),
                        output_nano_usd_per_token: Some(200),
                        ..ModelPricingProfile::default()
                    },
                    service_tier_profiles: BTreeMap::new(),
                    long_context: None,
                }],
            },
        )
        .await
        .expect("save pricing");
        let context = LogContext {
            client_ip: Some("198.51.100.10".to_string()),
            path: "/v1/chat/completions".to_string(),
            provider: "openai".to_string(),
            upstream_id: "test".to_string(),
            account_id: None,
            model: Some("openai/custom-model".to_string()),
            mapped_model: None,
            stream: false,
            status: 200,
            upstream_request_id: None,
            request_headers: None,
            request_body: None,
            ttfb_ms: None,
            timings: RequestTimings::default(),
            start: Instant::now(),
        };
        let entry = build_log_entry(
            &context,
            UsageSnapshot {
                usage: Some(TokenUsage {
                    input_tokens: Some(100),
                    output_tokens: Some(10),
                    total_tokens: Some(110),
                }),
                billable_usage: BillableUsage {
                    uncached_input_tokens: 75,
                    cache_read_tokens: 20,
                    cache_write_tokens: 5,
                    output_tokens: 10,
                    ..BillableUsage::default()
                },
                service_tier: None,
                usage_json: None,
            },
            None,
        );

        LogWriter::new(Some(pool.clone())).write(&entry).await;

        let row = sqlx::query(
            "SELECT client_ip, cost_nano_usd, pricing_version, pricing_model FROM request_logs LIMIT 1;",
        )
        .fetch_one(&pool)
        .await
        .expect("request log");
        assert_eq!(
            row.try_get::<String, _>("client_ip").ok().as_deref(),
            Some("198.51.100.10")
        );
        assert_eq!(row.try_get::<i64, _>("cost_nano_usd").ok(), Some(10_325));
        assert_eq!(
            row.try_get::<String, _>("pricing_version").ok().as_deref(),
            Some(snapshot.settings.version.as_str())
        );
        assert_eq!(
            row.try_get::<String, _>("pricing_model").ok().as_deref(),
            Some("custom-model")
        );
    }
}
