#![allow(clippy::field_reassign_with_default)]

use super::*;
use std::collections::HashMap;
use std::time::Duration;

#[test]
fn build_runtime_config_adds_new_default_hot_mapping_to_saved_overrides() {
    let mut config = ProxyConfigFile::default();
    // 模拟旧版本已保存的配置：字段存在，但尚未包含后来新增的默认 alias。
    config.hot_model_mappings =
        HashMap::from([("custom/alias".to_string(), "custom-target".to_string())]);

    let runtime = build_runtime_config(config).expect("runtime config");

    assert_eq!(
        runtime.hot_model_mappings.get("composer-2.5"),
        Some(&"grok-composer-2.5-fast".to_string())
    );
    assert_eq!(
        runtime.hot_model_mappings.get("custom/alias"),
        Some(&"custom-target".to_string())
    );
}

#[test]
fn build_runtime_config_keeps_user_override_for_default_hot_mapping() {
    let mut config = ProxyConfigFile::default();
    config.hot_model_mappings = HashMap::from([(
        "composer-2.5".to_string(),
        "vendor-composer-2.5".to_string(),
    )]);

    let runtime = build_runtime_config(config).expect("runtime config");

    assert_eq!(
        runtime.hot_model_mappings.get("composer-2.5"),
        Some(&"vendor-composer-2.5".to_string())
    );
}

#[test]
fn build_runtime_config_rejects_retryable_failure_cooldown_that_overflows_instant() {
    let mut config = ProxyConfigFile::default();
    config.retryable_failure_cooldown_secs = u64::MAX;

    let result = build_runtime_config(config);

    assert!(result.is_err());
}

#[test]
fn build_runtime_config_maps_same_upstream_retry_count() {
    let mut config = ProxyConfigFile::default();
    config.same_upstream_retry_count = 3;

    let runtime = build_runtime_config(config).expect("runtime config");

    assert_eq!(runtime.same_upstream_retry_count, 3);
}

#[test]
fn build_runtime_config_rejects_same_upstream_retry_count_above_max() {
    let mut config = ProxyConfigFile::default();
    config.same_upstream_retry_count = 6;

    let result = build_runtime_config(config);

    match result {
        Ok(_) => panic!("same_upstream_retry_count above max should be rejected"),
        Err(message) => assert!(message.contains("same_upstream_retry_count")),
    }
}

#[test]
fn build_runtime_config_routes_openai_responses_via_chat_when_enabled() {
    let mut config = ProxyConfigFile::default();
    config.upstreams = vec![UpstreamConfig {
        id: "glm-coding-plan".to_string(),
        providers: vec!["openai-response".to_string()],
        base_url: "https://open.bigmodel.cn/api/coding/paas/v4".to_string(),
        api_keys: vec!["test-key".to_string()],
        filter_prompt_cache_retention: false,
        filter_safety_identifier: false,
        use_chat_completions_for_responses: true,
        rewrite_developer_role_to_system: false,
        kiro_account_id: None,
        codex_account_id: None,
        xai_account_id: None,
        preferred_endpoint: None,
        proxy_url: None,
        priority: Some(0),
        enabled: true,
        available_models: Vec::new(),
        model_mappings: HashMap::new(),
        convert_from_map: HashMap::new(),
        overrides: None,
    }];

    let runtime = build_runtime_config(config).expect("runtime config");
    assert!(runtime.provider_upstreams("openai-response").is_none());

    let openai = runtime
        .provider_upstreams("openai")
        .expect("openai runtime upstream");
    let item = openai
        .groups
        .first()
        .and_then(|group| group.items.first())
        .expect("runtime item");

    assert!(item.supports_inbound(InboundApiFormat::OpenaiResponses));
    assert!(!item.supports_inbound(InboundApiFormat::OpenaiChat));
}

#[test]
fn build_runtime_config_keeps_openai_responses_provider_when_chat_compat_disabled() {
    let mut config = ProxyConfigFile::default();
    config.upstreams = vec![UpstreamConfig {
        id: "glm-coding-plan".to_string(),
        providers: vec!["openai-response".to_string()],
        base_url: "https://open.bigmodel.cn/api/coding/paas/v4".to_string(),
        api_keys: vec!["test-key".to_string()],
        filter_prompt_cache_retention: false,
        filter_safety_identifier: false,
        use_chat_completions_for_responses: false,
        rewrite_developer_role_to_system: false,
        kiro_account_id: None,
        codex_account_id: None,
        xai_account_id: None,
        preferred_endpoint: None,
        proxy_url: None,
        priority: Some(0),
        enabled: true,
        available_models: Vec::new(),
        model_mappings: HashMap::new(),
        convert_from_map: HashMap::new(),
        overrides: None,
    }];

    let runtime = build_runtime_config(config).expect("runtime config");
    assert!(runtime.provider_upstreams("openai").is_none());

    let openai_responses = runtime
        .provider_upstreams("openai-response")
        .expect("openai-response runtime upstream");
    let item = openai_responses
        .groups
        .first()
        .and_then(|group| group.items.first())
        .expect("runtime item");

    assert!(item.supports_inbound(InboundApiFormat::OpenaiResponses));
}

#[test]
fn build_runtime_config_normalizes_available_models() {
    let mut config = ProxyConfigFile::default();
    config.upstreams = vec![UpstreamConfig {
        id: "model-limited".to_string(),
        providers: vec!["openai".to_string()],
        base_url: "https://api.openai.com".to_string(),
        api_keys: vec!["test-key".to_string()],
        filter_prompt_cache_retention: false,
        filter_safety_identifier: false,
        use_chat_completions_for_responses: false,
        rewrite_developer_role_to_system: false,
        kiro_account_id: None,
        codex_account_id: None,
        xai_account_id: None,
        preferred_endpoint: None,
        proxy_url: None,
        priority: Some(0),
        enabled: true,
        available_models: vec![
            " gpt-5.4-mini ".to_string(),
            String::new(),
            "gpt-5.4".to_string(),
            "gpt-5.4".to_string(),
        ],
        model_mappings: HashMap::new(),
        convert_from_map: HashMap::new(),
        overrides: None,
    }];

    let runtime = build_runtime_config(config).expect("runtime config");
    let item = runtime
        .provider_upstreams("openai")
        .and_then(|upstreams| upstreams.groups.first())
        .and_then(|group| group.items.first())
        .expect("runtime item");

    assert_eq!(item.available_models, vec!["gpt-5.4", "gpt-5.4-mini"]);
    assert_eq!(item.advertised_model_ids, item.available_models);
    assert!(item.supports_model(Some("gpt-5.4")));
    assert!(!item.supports_model(Some("gpt-4.1")));
}

#[test]
fn build_runtime_config_codex_accepts_chat_and_responses_by_default() {
    let mut config = ProxyConfigFile::default();
    config.upstreams = vec![UpstreamConfig {
        id: "codex-account".to_string(),
        providers: vec!["codex".to_string()],
        base_url: String::new(),
        api_keys: Vec::new(),
        filter_prompt_cache_retention: false,
        filter_safety_identifier: false,
        use_chat_completions_for_responses: false,
        rewrite_developer_role_to_system: false,
        kiro_account_id: None,
        codex_account_id: None,
        xai_account_id: None,
        preferred_endpoint: None,
        proxy_url: None,
        priority: Some(0),
        enabled: true,
        available_models: Vec::new(),
        model_mappings: HashMap::new(),
        convert_from_map: HashMap::new(),
        overrides: None,
    }];

    let runtime = build_runtime_config(config).expect("runtime config");
    let codex = runtime
        .provider_upstreams("codex")
        .expect("codex runtime upstream");
    let item = codex
        .groups
        .first()
        .and_then(|group| group.items.first())
        .expect("runtime item");

    assert!(item.supports_inbound(InboundApiFormat::OpenaiChat));
    assert!(item.supports_inbound(InboundApiFormat::OpenaiResponses));
}

fn xai_upstream(base_url: &str) -> UpstreamConfig {
    UpstreamConfig {
        id: "xai-default".to_string(),
        providers: vec!["xai".to_string()],
        base_url: base_url.to_string(),
        api_keys: Vec::new(),
        filter_prompt_cache_retention: false,
        filter_safety_identifier: false,
        use_chat_completions_for_responses: false,
        rewrite_developer_role_to_system: false,
        kiro_account_id: None,
        codex_account_id: None,
        xai_account_id: Some("xai-user@example.com".to_string()),
        preferred_endpoint: None,
        proxy_url: None,
        priority: Some(0),
        enabled: true,
        available_models: Vec::new(),
        model_mappings: HashMap::new(),
        convert_from_map: HashMap::new(),
        overrides: None,
    }
}

#[test]
fn build_runtime_config_xai_uses_trusted_cli_endpoint_and_all_text_formats() {
    let mut config = ProxyConfigFile::default();
    config.upstreams = vec![xai_upstream("")];

    let runtime = build_runtime_config(config).expect("runtime config");
    let item = runtime
        .provider_upstreams("xai")
        .and_then(|upstreams| upstreams.groups.first())
        .and_then(|group| group.items.first())
        .expect("xai runtime item");

    assert_eq!(item.base_url, token_proxy_account_xai::CLI_BASE_URL);
    assert_eq!(item.xai_account_id.as_deref(), Some("xai-user@example.com"));
    assert!(item.supports_inbound(InboundApiFormat::OpenaiChat));
    assert!(item.supports_inbound(InboundApiFormat::OpenaiResponses));
    assert!(item.supports_inbound(InboundApiFormat::AnthropicMessages));
    assert!(item.supports_inbound(InboundApiFormat::Gemini));
}

#[test]
fn build_runtime_config_rejects_untrusted_xai_base_url() {
    let mut config = ProxyConfigFile::default();
    config.upstreams = vec![xai_upstream("https://example.com/v1")];

    let error = build_runtime_config(config)
        .err()
        .expect("custom xai base URL must fail");

    assert!(error.contains("xAI OAuth base_url"));
}

#[test]
fn build_runtime_config_rejects_api_key_for_xai_oauth_provider() {
    let mut config = ProxyConfigFile::default();
    let mut upstream = xai_upstream("");
    upstream.api_keys = vec!["not-an-oauth-account".to_string()];
    config.upstreams = vec![upstream];

    let error = build_runtime_config(config)
        .err()
        .expect("xai API key must fail");

    assert!(error.contains("does not accept api_keys"));
}

#[test]
fn build_runtime_config_rejects_foreign_account_binding_for_xai() {
    let mut config = ProxyConfigFile::default();
    let mut upstream = xai_upstream("");
    upstream.codex_account_id = Some("codex-account".to_string());
    config.upstreams = vec![upstream];

    let error = build_runtime_config(config)
        .err()
        .expect("foreign account binding must fail");

    assert!(error.contains("only accepts xai_account_id"));
}

#[test]
fn build_runtime_config_rejects_xai_account_binding_for_other_provider() {
    let mut config = ProxyConfigFile::default();
    let mut upstream = xai_upstream("https://api.openai.com/v1");
    upstream.providers = vec!["openai".to_string()];
    config.upstreams = vec![upstream];

    let error = build_runtime_config(config)
        .err()
        .expect("xai binding on openai must fail");

    assert!(error.contains("xai_account_id requires provider xai"));
}

#[test]
fn build_runtime_config_maps_stream_first_output_timeout_secs() {
    let mut config = ProxyConfigFile::default();
    config.stream_first_output_timeout_secs = 3;

    let runtime = build_runtime_config(config).expect("runtime config");

    assert_eq!(runtime.stream_first_output_timeout, Duration::from_secs(3));
}

#[test]
fn build_runtime_config_maps_sync_response_timeout_secs() {
    let mut config = ProxyConfigFile::default();
    config.sync_response_timeout_secs = 30;

    let runtime = build_runtime_config(config).expect("runtime config");

    assert_eq!(runtime.sync_response_timeout, Duration::from_secs(30));
}

#[test]
fn build_runtime_config_maps_split_timeout_defaults() {
    let runtime = build_runtime_config(ProxyConfigFile::default()).expect("runtime config");

    assert_eq!(runtime.stream_first_output_timeout, Duration::from_secs(60));
    assert_eq!(runtime.sync_response_timeout, Duration::from_secs(300));
}

#[test]
fn build_runtime_config_maps_codex_session_scoped_cooldown_switch() {
    let mut config = ProxyConfigFile::default();
    config.codex_session_scoped_cooldown_enabled = true;

    let runtime = build_runtime_config(config).expect("runtime config");

    assert!(runtime.codex_session_scoped_cooldown_enabled);
}

#[test]
fn build_runtime_config_maps_hedged_strategy() {
    let mut config = ProxyConfigFile::default();
    config.upstream_strategy = UpstreamStrategy {
        order: UpstreamOrderStrategy::RoundRobin,
        dispatch: UpstreamDispatchStrategy::Hedged {
            delay_ms: 250,
            max_parallel: 3,
        },
    };

    let runtime = build_runtime_config(config).expect("runtime config");

    assert_eq!(
        runtime.upstream_strategy.order,
        UpstreamOrderStrategy::RoundRobin
    );
    assert_eq!(
        runtime.upstream_strategy.dispatch,
        UpstreamDispatchRuntime::Hedged {
            delay: Duration::from_millis(250),
            max_parallel: 3,
        }
    );
}

#[test]
fn build_runtime_config_maps_race_strategy() {
    let mut config = ProxyConfigFile::default();
    config.upstream_strategy = UpstreamStrategy {
        order: UpstreamOrderStrategy::RoundRobin,
        dispatch: UpstreamDispatchStrategy::Race { max_parallel: 4 },
    };

    let runtime = build_runtime_config(config).expect("runtime config");

    assert_eq!(
        runtime.upstream_strategy.order,
        UpstreamOrderStrategy::RoundRobin
    );
    assert_eq!(
        runtime.upstream_strategy.dispatch,
        UpstreamDispatchRuntime::Race { max_parallel: 4 }
    );
}

#[test]
fn build_runtime_config_rejects_hedged_strategy_with_zero_delay() {
    let mut config = ProxyConfigFile::default();
    config.upstream_strategy = UpstreamStrategy {
        order: UpstreamOrderStrategy::FillFirst,
        dispatch: UpstreamDispatchStrategy::Hedged {
            delay_ms: 0,
            max_parallel: 2,
        },
    };

    let result = build_runtime_config(config);

    assert!(result.is_err());
}

#[test]
fn build_runtime_config_rejects_hedged_strategy_with_max_parallel_below_two() {
    let mut config = ProxyConfigFile::default();
    config.upstream_strategy = UpstreamStrategy {
        order: UpstreamOrderStrategy::FillFirst,
        dispatch: UpstreamDispatchStrategy::Hedged {
            delay_ms: 250,
            max_parallel: 1,
        },
    };

    let result = build_runtime_config(config);

    assert!(result.is_err());
}

#[test]
fn build_runtime_config_rejects_race_strategy_with_max_parallel_below_two() {
    let mut config = ProxyConfigFile::default();
    config.upstream_strategy = UpstreamStrategy {
        order: UpstreamOrderStrategy::FillFirst,
        dispatch: UpstreamDispatchStrategy::Race { max_parallel: 1 },
    };

    let result = build_runtime_config(config);

    assert!(result.is_err());
}

#[test]
fn build_runtime_config_rejects_stream_first_output_timeout_below_minimum() {
    let mut config = ProxyConfigFile::default();
    config.stream_first_output_timeout_secs = 0;

    let result = build_runtime_config(config);

    assert!(result.is_err());
}

#[test]
fn build_runtime_config_rejects_sync_response_timeout_below_minimum() {
    let mut config = ProxyConfigFile::default();
    config.sync_response_timeout_secs = 0;

    let result = build_runtime_config(config);

    assert!(result.is_err());
}

#[test]
fn build_runtime_config_rejects_stream_first_output_timeout_that_overflows_instant() {
    let mut config = ProxyConfigFile::default();
    config.stream_first_output_timeout_secs = u64::MAX;

    let result = build_runtime_config(config);

    assert!(result.is_err());
}

#[test]
fn build_runtime_config_rejects_sync_response_timeout_that_overflows_instant() {
    let mut config = ProxyConfigFile::default();
    config.sync_response_timeout_secs = u64::MAX;

    let result = build_runtime_config(config);

    assert!(result.is_err());
}

#[test]
fn build_runtime_config_expands_multiple_api_keys_into_multiple_runtime_upstreams() {
    let mut config = ProxyConfigFile::default();
    config.upstreams = vec![UpstreamConfig {
        id: "shared-openai".to_string(),
        providers: vec!["openai".to_string()],
        base_url: "https://api.openai.com".to_string(),
        api_keys: vec!["key-a".to_string(), "key-b".to_string()],
        filter_prompt_cache_retention: false,
        filter_safety_identifier: false,
        use_chat_completions_for_responses: false,
        rewrite_developer_role_to_system: false,
        kiro_account_id: None,
        codex_account_id: None,
        xai_account_id: None,
        preferred_endpoint: None,
        proxy_url: None,
        priority: Some(0),
        enabled: true,
        available_models: Vec::new(),
        model_mappings: HashMap::new(),
        convert_from_map: HashMap::new(),
        overrides: None,
    }];

    let runtime = build_runtime_config(config).expect("runtime config");
    let openai = runtime
        .provider_upstreams("openai")
        .expect("openai runtime upstream");
    let items = &openai.groups[0].items;

    assert_eq!(items.len(), 2);
    assert_eq!(items[0].id, "shared-openai");
    assert_eq!(items[0].selector_key, "shared-openai#1");
    assert_eq!(items[0].api_key.as_deref(), Some("key-a"));
    assert_eq!(items[1].selector_key, "shared-openai#2");
    assert_eq!(items[1].api_key.as_deref(), Some("key-b"));
}

#[test]
fn build_runtime_config_rejects_api_key_that_cannot_be_precompiled_as_header() {
    let mut config = ProxyConfigFile::default();
    config.upstreams = vec![UpstreamConfig {
        id: "bad-openai".to_string(),
        providers: vec!["openai".to_string()],
        base_url: "https://api.openai.com".to_string(),
        api_keys: vec!["bad\nkey".to_string()],
        filter_prompt_cache_retention: false,
        filter_safety_identifier: false,
        use_chat_completions_for_responses: false,
        rewrite_developer_role_to_system: false,
        kiro_account_id: None,
        codex_account_id: None,
        xai_account_id: None,
        preferred_endpoint: None,
        proxy_url: None,
        priority: Some(0),
        enabled: true,
        available_models: Vec::new(),
        model_mappings: HashMap::new(),
        convert_from_map: HashMap::new(),
        overrides: None,
    }];

    let result = build_runtime_config(config);

    assert!(result.is_err());
}

#[test]
fn build_runtime_config_rejects_unsupported_provider() {
    let mut config = ProxyConfigFile::default();
    config.upstreams = vec![UpstreamConfig {
        id: "removed-provider".to_string(),
        providers: vec!["legacy-provider".to_string()],
        base_url: String::new(),
        api_keys: Vec::new(),
        filter_prompt_cache_retention: false,
        filter_safety_identifier: false,
        use_chat_completions_for_responses: false,
        rewrite_developer_role_to_system: false,
        kiro_account_id: None,
        codex_account_id: None,
        xai_account_id: None,
        preferred_endpoint: None,
        proxy_url: None,
        priority: Some(0),
        enabled: true,
        available_models: Vec::new(),
        model_mappings: HashMap::new(),
        convert_from_map: HashMap::new(),
        overrides: None,
    }];

    let result = build_runtime_config(config);

    assert!(result.is_err());
}

#[test]
fn build_runtime_config_rejects_multiple_api_keys_for_account_based_provider() {
    let mut config = ProxyConfigFile::default();
    config.upstreams = vec![UpstreamConfig {
        id: "codex-account".to_string(),
        providers: vec!["codex".to_string()],
        base_url: String::new(),
        api_keys: vec!["key-a".to_string(), "key-b".to_string()],
        filter_prompt_cache_retention: false,
        filter_safety_identifier: false,
        use_chat_completions_for_responses: false,
        rewrite_developer_role_to_system: false,
        kiro_account_id: None,
        codex_account_id: Some("codex-account.json".to_string()),
        xai_account_id: None,
        preferred_endpoint: None,
        proxy_url: None,
        priority: Some(0),
        enabled: true,
        available_models: Vec::new(),
        model_mappings: HashMap::new(),
        convert_from_map: HashMap::new(),
        overrides: None,
    }];

    let result = build_runtime_config(config);

    assert!(result.is_err());
}

#[test]
fn build_runtime_config_allows_account_based_provider_without_binding_account_id() {
    let mut config = ProxyConfigFile::default();
    config.upstreams = vec![
        UpstreamConfig {
            id: "kiro-default".to_string(),
            providers: vec!["kiro".to_string()],
            base_url: String::new(),
            api_keys: Vec::new(),
            filter_prompt_cache_retention: false,
            filter_safety_identifier: false,
            use_chat_completions_for_responses: false,
            rewrite_developer_role_to_system: false,
            kiro_account_id: None,
            codex_account_id: None,
            xai_account_id: None,
            preferred_endpoint: None,
            proxy_url: None,
            priority: Some(0),
            enabled: true,
            available_models: Vec::new(),
            model_mappings: HashMap::new(),
            convert_from_map: HashMap::new(),
            overrides: None,
        },
        UpstreamConfig {
            id: "codex-default".to_string(),
            providers: vec!["codex".to_string()],
            base_url: String::new(),
            api_keys: Vec::new(),
            filter_prompt_cache_retention: false,
            filter_safety_identifier: false,
            use_chat_completions_for_responses: false,
            rewrite_developer_role_to_system: false,
            kiro_account_id: None,
            codex_account_id: None,
            xai_account_id: None,
            preferred_endpoint: None,
            proxy_url: None,
            priority: Some(0),
            enabled: true,
            available_models: Vec::new(),
            model_mappings: HashMap::new(),
            convert_from_map: HashMap::new(),
            overrides: None,
        },
    ];

    let result = build_runtime_config(config);

    assert!(result.is_ok());
}
