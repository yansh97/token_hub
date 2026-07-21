import type {
  ConfigForm,
  InboundApiFormat,
  ModelMappingForm,
  ProxyConfigFile,
  ProxyConfigFileBase,
  TrayTokenRateConfig,
  UpstreamDispatchStrategy,
  UpstreamForm,
  UpstreamStrategy,
} from "@/features/config/types";
import {
  createNativeInboundFormatSet,
  removeInboundFormatsInSet,
} from "@/features/config/inbound-formats";

const DEFAULT_TRAY_TOKEN_RATE: TrayTokenRateConfig = {
  enabled: true,
  format: "split",
};

const MIN_TIMEOUT_SECS = 1;
const DEFAULT_STREAM_FIRST_OUTPUT_TIMEOUT_SECS = 60;
const DEFAULT_SYNC_RESPONSE_TIMEOUT_SECS = 300;
const DEFAULT_HEDGE_DELAY_MS = 2000;
const DEFAULT_MAX_PARALLEL = 2;
const MIN_PARALLEL_ATTEMPTS = 2;
const SUPPORTED_PROVIDERS = new Set([
  "openai",
  "openai-response",
  "anthropic",
  "gemini",
]);
const DEFAULT_UPSTREAM_PROVIDERS = [
  "openai",
  "openai-response",
  "anthropic",
  "gemini",
] as const;
const DEFAULT_PROXY_PORT = import.meta.env.DEV ? "19208" : "9208";
const DEFAULT_UPSTREAM_PRIORITY = "100";
const INTEGER_PATTERN = /^-?\d+$/;
const NON_NEGATIVE_INTEGER_PATTERN = /^\d+$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
let modelMappingCounter = 0;

function joinListInput(values: string[] | null | undefined) {
  return values?.length ? values.join(", ") : "";
}

function parseApiKeysInput(value: string) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of value.split(/[,\n]/)) {
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    output.push(trimmed);
  }
  return output;
}

function normalizeAvailableModels(values: readonly string[]) {
  const models = new Set<string>();
  for (const value of values) {
    const model = value.trim();
    if (model) {
      models.add(model);
    }
  }
  return [...models].sort();
}

const KNOWN_CONFIG_KEYS: ReadonlySet<string> = new Set([
  "host",
  "port",
  "local_api_key",
  "app_proxy_url",
  "cors_enabled",
  "model_list_prefix",
  "log_level",
  "retryable_failure_cooldown_secs",
  "same_upstream_retry_count",
  "stream_first_output_timeout_secs",
  "sync_response_timeout_secs",
  "tray_token_rate",
  "upstream_strategy",
  "hot_model_mappings",
  "upstreams",
]);

const REMOVED_CONFIG_KEYS: ReadonlySet<string> = new Set([
  "upstream_no_data_timeout_secs",
  "openai_response_header_timeout_secs",
]);

export const EMPTY_FORM: ConfigForm = {
  host: "127.0.0.1",
  port: DEFAULT_PROXY_PORT,
  localApiKey: "",
  appProxyUrl: "",
  corsEnabled: false,
  modelListPrefix: false,
  logLevel: "silent",
  retryableFailureCooldownSecs: "15",
  sameUpstreamRetryCount: "1",
  streamFirstOutputTimeoutSecs: String(
    DEFAULT_STREAM_FIRST_OUTPUT_TIMEOUT_SECS,
  ),
  syncResponseTimeoutSecs: String(DEFAULT_SYNC_RESPONSE_TIMEOUT_SECS),
  trayTokenRate: { ...DEFAULT_TRAY_TOKEN_RATE },
  upstreamStrategy: {
    order: "fill_first",
    dispatchType: "serial",
    hedgeDelayMs: String(DEFAULT_HEDGE_DELAY_MS),
    maxParallel: String(DEFAULT_MAX_PARALLEL),
  },
  hotModelMappings: [],
  upstreams: [],
};

export function createEmptyUpstream(): UpstreamForm {
  return {
    id: "",
    providers: [...DEFAULT_UPSTREAM_PROVIDERS],
    baseUrl: "",
    apiKeys: "",
    filterPromptCacheRetention: false,
    filterSafetyIdentifier: false,
    useChatCompletionsForResponses: false,
    rewriteDeveloperRoleToSystem: false,
    proxyUrl: "",
    priority: DEFAULT_UPSTREAM_PRIORITY,
    enabled: false,
    availableModelsMode: "all",
    availableModels: [],
    modelMappings: [],
    convertFromMap: {},
    overrides: { header: [] },
  };
}

export function createModelMapping(pattern = "", target = "") {
  // 稳定 id 用于列表渲染，避免输入时因 key 变化导致焦点丢失
  modelMappingCounter += 1;
  return {
    id: `model-mapping-${Date.now()}-${modelMappingCounter}`,
    pattern,
    target,
  };
}

export function extractConfigExtras(config: ProxyConfigFile) {
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (REMOVED_CONFIG_KEYS.has(key)) {
      continue;
    }
    if (!KNOWN_CONFIG_KEYS.has(key)) {
      extras[key] = value;
    }
  }
  return extras;
}

export function mergeConfigExtras(
  config: ProxyConfigFileBase,
  extras: Record<string, unknown>,
) {
  return {
    ...extras,
    ...config,
  };
}

const KNOWN_UPSTREAM_KEYS: ReadonlySet<string> = new Set([
  "id",
  "providers",
  "base_url",
  "api_keys",
  "filter_prompt_cache_retention",
  "filter_safety_identifier",
  "use_chat_completions_for_responses",
  "rewrite_developer_role_to_system",
  "proxy_url",
  "priority",
  "enabled",
  "available_models",
  "model_mappings",
  "convert_from_map",
  "overrides",
]);

function extractUpstreamExtras(upstream: ProxyConfigFile["upstreams"][number]) {
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(upstream)) {
    if (!KNOWN_UPSTREAM_KEYS.has(key)) {
      extras[key] = value;
    }
  }
  return extras;
}

export function toForm(config: ProxyConfigFile): ConfigForm {
  return {
    host: config.host,
    port: String(config.port),
    localApiKey: config.local_api_key ?? "",
    appProxyUrl: config.app_proxy_url ?? "",
    corsEnabled: config.cors_enabled ?? false,
    modelListPrefix: config.model_list_prefix ?? false,
    logLevel: config.log_level ?? "silent",
    retryableFailureCooldownSecs: String(
      config.retryable_failure_cooldown_secs ?? 15,
    ),
    sameUpstreamRetryCount: String(config.same_upstream_retry_count ?? 1),
    streamFirstOutputTimeoutSecs: String(
      config.stream_first_output_timeout_secs ??
        DEFAULT_STREAM_FIRST_OUTPUT_TIMEOUT_SECS,
    ),
    syncResponseTimeoutSecs: String(
      config.sync_response_timeout_secs ?? DEFAULT_SYNC_RESPONSE_TIMEOUT_SECS,
    ),
    trayTokenRate: { ...DEFAULT_TRAY_TOKEN_RATE },
    upstreamStrategy: toUpstreamStrategyForm(config.upstream_strategy),
    hotModelMappings: toModelMappingForm(config.hot_model_mappings ?? {}),
    upstreams: config.upstreams.map((upstream) => {
      const providers = upstream.providers ?? [];
      const availableModels = normalizeAvailableModels(
        upstream.available_models ?? [],
      );
      return {
        id: upstream.id,
        providers,
        baseUrl: upstream.base_url,
        apiKeys: joinListInput(upstream.api_keys),
        filterPromptCacheRetention:
          upstream.filter_prompt_cache_retention ?? false,
        filterSafetyIdentifier: upstream.filter_safety_identifier ?? false,
        useChatCompletionsForResponses:
          upstream.use_chat_completions_for_responses ?? false,
        rewriteDeveloperRoleToSystem:
          upstream.rewrite_developer_role_to_system ?? false,
        proxyUrl: upstream.proxy_url ?? "",
        priority: upstream.priority === null ? "" : String(upstream.priority),
        enabled: upstream.enabled,
        availableModelsMode: availableModels.length ? "selected" : "all",
        availableModels,
        modelMappings: toModelMappingForm(upstream.model_mappings),
        convertFromMap: upstream.convert_from_map ?? {},
        overrides: normalizeOverrides(upstream.overrides),
        extras: extractUpstreamExtras(upstream),
      };
    }),
  };
}

export function toPayload(form: ConfigForm): ProxyConfigFile {
  const port = Number.parseInt(form.port, 10);
  return {
    host: form.host.trim(),
    port,
    local_api_key: form.localApiKey.trim() ? form.localApiKey.trim() : null,
    app_proxy_url: form.appProxyUrl.trim() ? form.appProxyUrl.trim() : null,
    cors_enabled: form.corsEnabled,
    model_list_prefix: form.modelListPrefix,
    log_level: form.logLevel,
    retryable_failure_cooldown_secs: parseRetryableFailureCooldownSecs(
      form.retryableFailureCooldownSecs,
    ),
    same_upstream_retry_count: parseSameUpstreamRetryCount(
      form.sameUpstreamRetryCount,
    ),
    stream_first_output_timeout_secs: parseTimeoutSecs(
      form.streamFirstOutputTimeoutSecs,
      DEFAULT_STREAM_FIRST_OUTPUT_TIMEOUT_SECS,
    ),
    sync_response_timeout_secs: parseTimeoutSecs(
      form.syncResponseTimeoutSecs,
      DEFAULT_SYNC_RESPONSE_TIMEOUT_SECS,
    ),
    tray_token_rate: { ...DEFAULT_TRAY_TOKEN_RATE },
    upstream_strategy: toUpstreamStrategyPayload(form.upstreamStrategy),
    hot_model_mappings: toModelMappingPayload(form.hotModelMappings),
    upstreams: form.upstreams.map((upstream) => {
      const providers = normalizeProviders(upstream.providers);
      const apiKeys = parseApiKeysInput(upstream.apiKeys);
      return {
        ...upstream.extras,
        id: upstream.id.trim(),
        providers,
        base_url: upstream.baseUrl.trim(),
        api_keys: apiKeys.length ? apiKeys : undefined,
        filter_prompt_cache_retention: upstream.filterPromptCacheRetention,
        filter_safety_identifier: upstream.filterSafetyIdentifier,
        use_chat_completions_for_responses:
          upstream.useChatCompletionsForResponses,
        rewrite_developer_role_to_system: upstream.rewriteDeveloperRoleToSystem,
        proxy_url: upstream.proxyUrl.trim() ? upstream.proxyUrl.trim() : null,
        priority: parseOptionalInt(upstream.priority),
        enabled: upstream.enabled,
        available_models:
          upstream.availableModelsMode === "selected"
            ? normalizeAvailableModels(upstream.availableModels)
            : undefined,
        model_mappings: toModelMappingPayload(upstream.modelMappings),
        convert_from_map: normalizeConvertFromMap(
          upstream.convertFromMap,
          providers,
        ),
        overrides: toOverridesPayload(upstream.overrides),
      };
    }),
  };
}

export type SettingsFieldKey =
  | "host"
  | "port"
  | "retryableFailureCooldownSecs"
  | "sameUpstreamRetryCount"
  | "streamFirstOutputTimeoutSecs"
  | "syncResponseTimeoutSecs";

export type SettingsFieldErrors = Partial<Record<SettingsFieldKey, string>>;

export function validateSettingsFields(form: ConfigForm): SettingsFieldErrors {
  const errors: SettingsFieldErrors = {};
  if (!form.host.trim()) {
    errors.host = "监听地址不能为空。";
  }
  if (!NON_NEGATIVE_INTEGER_PATTERN.test(form.port.trim())) {
    errors.port = "端口必须是 1 到 65535 之间的整数。";
  } else {
    const port = Number(form.port.trim());
    if (port < 1 || port > 65535) {
      errors.port = "端口必须是 1 到 65535 之间的整数。";
    }
  }
  if (!isValidRetryableFailureCooldownSecs(form.retryableFailureCooldownSecs)) {
    errors.retryableFailureCooldownSecs = "必须是大于等于 0 的整数。";
  }
  if (!isValidSameUpstreamRetryCount(form.sameUpstreamRetryCount)) {
    errors.sameUpstreamRetryCount = "必须是 0 到 5 之间的整数。";
  }
  if (!isValidTimeoutSecs(form.streamFirstOutputTimeoutSecs)) {
    errors.streamFirstOutputTimeoutSecs = "必须是大于等于 1 的整数。";
  }
  if (!isValidTimeoutSecs(form.syncResponseTimeoutSecs)) {
    errors.syncResponseTimeoutSecs = "必须是大于等于 1 的整数。";
  }
  return errors;
}

export type UpstreamDraftValidation = {
  valid: boolean;
  message: string;
  errors: Record<string, string>;
};

type ValidateUpstreamDraftArgs = {
  draft: UpstreamForm;
  upstreams: readonly UpstreamForm[];
  index: number | null;
  appProxyUrl: string;
};

function hasInvalidHeaderValueCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x08 || (code >= 0x0a && code <= 0x1f) || code === 0x7f) {
      return true;
    }
  }
  return false;
}

export function validateUpstreamDraft({
  draft,
  upstreams,
  index,
  appProxyUrl,
}: ValidateUpstreamDraftArgs): UpstreamDraftValidation {
  const errors: Record<string, string> = {};
  let message = "";
  const addError = (field: string, value: string) => {
    errors[field] = value;
    if (!message) {
      message = value;
    }
  };
  const id = draft.id.trim();
  if (!id) {
    addError("id", "提供商 ID 不能为空。");
  } else if (
    upstreams.some(
      (upstream, current) => current !== index && upstream.id.trim() === id,
    )
  ) {
    addError("id", `提供商 ID 已存在：${id}。`);
  }

  const providers = normalizeProviders(draft.providers);
  if (!providers.length) {
    addError("providers", "请至少选择一种接口格式。");
  }
  if (parseApiKeysInput(draft.apiKeys).some(hasInvalidHeaderValueCharacter)) {
    addError("apiKeys", "API Key 包含不能用于 HTTP 请求头的字符。");
  }
  if (providers.some((provider) => !SUPPORTED_PROVIDERS.has(provider))) {
    addError("providers", "包含不受支持的接口格式。");
  }

  const baseUrl = draft.baseUrl.trim();
  if (!baseUrl) {
    addError("baseUrl", "Base URL 不能为空。");
  } else if (baseUrl && !isValidHttpUrl(baseUrl)) {
    addError("baseUrl", "请输入有效的 HTTP 或 HTTPS URL。");
  }

  if (
    draft.availableModelsMode === "selected" &&
    normalizeAvailableModels(draft.availableModels).length === 0
  ) {
    addError("availableModels", "请至少添加一个可用模型。");
  }

  for (const provider of Object.keys(draft.convertFromMap)) {
    if (!providers.includes(provider)) {
      addError("convertFromMap", "可转格式包含未选择的目标接口格式。");
      break;
    }
  }

  const upstreamProxyUrl = draft.proxyUrl.trim();
  if (upstreamProxyUrl) {
    if (upstreamProxyUrl === APP_PROXY_URL_PLACEHOLDER) {
      if (!appProxyUrl.trim()) {
        addError("proxyUrl", "使用 $app_proxy_url 前必须先配置应用代理。");
      }
    } else if (!isValidProxyUrl(upstreamProxyUrl)) {
      addError("proxyUrl", "代理 URL 格式无效。");
    }
  }
  if (!draft.priority.trim()) {
    addError("priority", "优先级不能为空。");
  } else if (!isValidOptionalInt(draft.priority)) {
    addError("priority", "优先级必须是有效的整数。");
  }

  validateModelMappingRows(draft.modelMappings, addError);
  validateHeaderOverrideRows(draft.overrides.header, addError);

  return { valid: !message, message, errors };
}

export function validate(form: ConfigForm) {
  const settingsErrors = validateSettingsFields(form);
  const firstSettingsError = Object.values(settingsErrors)[0];
  if (firstSettingsError) {
    return { valid: false, message: firstSettingsError };
  }
  if (form.appProxyUrl.trim() && !isValidProxyUrl(form.appProxyUrl.trim())) {
    return {
      valid: false,
      message: "应用代理 URL 无效（支持 http(s)://、socks5://、socks5h://）。",
    };
  }
  const upstreamStrategyError = validateUpstreamStrategy(form.upstreamStrategy);
  if (upstreamStrategyError) {
    return { valid: false, message: upstreamStrategyError };
  }
  const hotModelMappingError = validateModelMappings(
    form.hotModelMappings,
    "hot_model_mappings",
  );
  if (hotModelMappingError) {
    return { valid: false, message: hotModelMappingError };
  }

  for (let index = 0; index < form.upstreams.length; index += 1) {
    const result = validateUpstreamDraft({
      draft: form.upstreams[index],
      upstreams: form.upstreams,
      index,
      appProxyUrl: form.appProxyUrl,
    });
    if (!result.valid) {
      return { valid: false, message: result.message };
    }
  }

  return { valid: true, message: "" };
}

const APP_PROXY_URL_PLACEHOLDER = "$app_proxy_url";

const PROXY_URL_PROTOCOLS: ReadonlySet<string> = new Set([
  "http:",
  "https:",
  "socks5:",
  "socks5h:",
]);

function isValidProxyUrl(value: string) {
  try {
    const parsed = new URL(value);
    return PROXY_URL_PROTOCOLS.has(parsed.protocol);
  } catch (_) {
    return false;
  }
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function toModelMappingForm(
  mappings: Record<string, string>,
): ModelMappingForm[] {
  return Object.entries(mappings).map(([pattern, target]) =>
    createModelMapping(pattern, target),
  );
}

type HeaderOverrideForm =
  ConfigForm["upstreams"][number]["overrides"]["header"][number];

function normalizeOverrides(
  overrides?: ProxyConfigFile["upstreams"][number]["overrides"],
): ConfigForm["upstreams"][number]["overrides"] {
  const header = Object.entries(overrides?.header ?? {}).map(
    ([name, value], index): HeaderOverrideForm => ({
      id: `header-override-${Date.now()}-${index}`,
      name,
      value: value ?? "",
      isNull: value === null,
    }),
  );
  return { header };
}

function toModelMappingPayload(mappings: ModelMappingForm[]) {
  const entries = mappings.map((mapping): [string, string] => [
    mapping.pattern.trim(),
    mapping.target.trim(),
  ]);
  return Object.fromEntries(entries);
}

function toOverridesPayload(
  overrides: ConfigForm["upstreams"][number]["overrides"],
) {
  const headerEntries = overrides.header
    .map(
      ({ name, value, isNull }) =>
        [name.trim(), isNull ? null : value.trim()] as const,
    )
    .filter(([name]) => name);
  if (!headerEntries.length) {
    return undefined;
  }
  return {
    header: Object.fromEntries(headerEntries),
  };
}

function toUpstreamStrategyForm(
  strategy: UpstreamStrategy,
): ConfigForm["upstreamStrategy"] {
  switch (strategy.dispatch.type) {
    case "serial":
      return {
        order: strategy.order,
        dispatchType: "serial",
        hedgeDelayMs: String(DEFAULT_HEDGE_DELAY_MS),
        maxParallel: String(DEFAULT_MAX_PARALLEL),
      };
    case "hedged":
      return {
        order: strategy.order,
        dispatchType: "hedged",
        hedgeDelayMs: String(strategy.dispatch.delay_ms),
        maxParallel: String(strategy.dispatch.max_parallel),
      };
    case "race":
      return {
        order: strategy.order,
        dispatchType: "race",
        hedgeDelayMs: String(DEFAULT_HEDGE_DELAY_MS),
        maxParallel: String(strategy.dispatch.max_parallel),
      };
  }
}

function toUpstreamStrategyPayload(
  strategy: ConfigForm["upstreamStrategy"],
): UpstreamStrategy {
  return {
    order: strategy.order,
    dispatch: toUpstreamDispatchPayload(strategy),
  };
}

function toUpstreamDispatchPayload(
  strategy: ConfigForm["upstreamStrategy"],
): UpstreamDispatchStrategy {
  switch (strategy.dispatchType) {
    case "serial":
      return { type: "serial" };
    case "hedged":
      return {
        type: "hedged",
        delay_ms: parsePositiveInteger(
          strategy.hedgeDelayMs,
          DEFAULT_HEDGE_DELAY_MS,
        ),
        max_parallel: parseMinParallel(
          strategy.maxParallel,
          DEFAULT_MAX_PARALLEL,
        ),
      };
    case "race":
      return {
        type: "race",
        max_parallel: parseMinParallel(
          strategy.maxParallel,
          DEFAULT_MAX_PARALLEL,
        ),
      };
  }
}

function validateUpstreamStrategy(strategy: ConfigForm["upstreamStrategy"]) {
  if (strategy.dispatchType === "serial") {
    return "";
  }
  if (
    strategy.dispatchType === "hedged" &&
    !isPositiveInteger(strategy.hedgeDelayMs)
  ) {
    return "Hedge 延迟必须是正整数。";
  }
  if (!isValidMinParallel(strategy.maxParallel)) {
    return `最大并发数必须是不小于 ${MIN_PARALLEL_ATTEMPTS} 的整数。`;
  }
  return "";
}

function normalizeProviders(values: readonly string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    output.push(trimmed);
  }
  return output;
}

function normalizeConvertFromMap(
  map: Record<string, InboundApiFormat[]>,
  providers: readonly string[],
) {
  if (!Object.keys(map).length) {
    return undefined;
  }
  const providerSet = new Set(providers);
  // 若某个入站格式已经被该 upstream 的某个 provider 原生支持，则无需（也不应）再通过 convert_from_map
  // 把它授权给其它 provider，否则只会造成冗余与误导。
  const nativeFormatsInUpstream = createNativeInboundFormatSet(providers);
  const outputEntries: Array<[string, InboundApiFormat[]]> = [];
  for (const [provider, formats] of Object.entries(map)) {
    if (!providerSet.has(provider)) {
      continue;
    }
    // UI 会隐藏该 upstream 已原生支持的入站格式；这里也做一次清理，避免历史冗余配置被保存回去。
    const filtered = removeInboundFormatsInSet(
      formats,
      nativeFormatsInUpstream,
    );
    const unique: InboundApiFormat[] = [];
    const seen = new Set<InboundApiFormat>();
    for (const format of filtered) {
      if (seen.has(format)) {
        continue;
      }
      seen.add(format);
      unique.push(format);
    }
    if (!unique.length) {
      continue;
    }
    outputEntries.push([provider, unique]);
  }
  if (!outputEntries.length) {
    return undefined;
  }
  return Object.fromEntries(outputEntries);
}

function validateModelMappings(
  mappings: ModelMappingForm[],
  upstreamId: string,
) {
  let firstError = "";
  validateModelMappingRows(mappings, (_field, message) => {
    if (!firstError) {
      firstError = `提供商 ${upstreamId} ${message}`;
    }
  });
  return firstError;
}

function validateModelMappingRows(
  mappings: ModelMappingForm[],
  addError: (field: string, message: string) => void,
) {
  const seen = new Set<string>();
  let wildcardSeen = false;
  for (let index = 0; index < mappings.length; index += 1) {
    const row = String(index + 1);
    const mapping = mappings[index];
    const pattern = mapping?.pattern.trim() ?? "";
    const target = mapping?.target.trim() ?? "";
    const fieldPrefix = `modelMappings.${mapping?.id ?? index}`;
    if (!pattern) {
      addError(
        `${fieldPrefix}.pattern`,
        `第 ${row} 行映射的匹配模式不能为空。`,
      );
    }
    if (!target) {
      addError(`${fieldPrefix}.target`, `第 ${row} 行映射的目标模型不能为空。`);
    }
    if (pattern && seen.has(pattern)) {
      addError(`${fieldPrefix}.pattern`, `匹配模式重复：${pattern}。`);
    }
    if (pattern) {
      seen.add(pattern);
    }

    if (pattern === "*") {
      if (wildcardSeen) {
        addError(`${fieldPrefix}.pattern`, "只能定义一个通配映射“*”。");
      }
      wildcardSeen = true;
      continue;
    }

    if (pattern.includes("*") && !pattern.endsWith("*")) {
      addError(`${fieldPrefix}.pattern`, `匹配模式无效：${pattern}。`);
    }

    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1).trim();
      if (!prefix) {
        addError(`${fieldPrefix}.pattern`, `第 ${row} 行映射的前缀不能为空。`);
      }
      if (prefix.includes("*")) {
        addError(`${fieldPrefix}.pattern`, `匹配模式无效：${pattern}。`);
      }
    }
  }
}

function validateHeaderOverrideRows(
  overrides: ConfigForm["upstreams"][number]["overrides"]["header"],
  addError: (field: string, message: string) => void,
) {
  const seen = new Set<string>();
  for (let index = 0; index < overrides.length; index += 1) {
    const row = String(index + 1);
    const item = overrides[index];
    const name = item?.name.trim() ?? "";
    const field = `headerOverrides.${item?.id ?? index}.name`;
    if (!name) {
      addError(field, `第 ${row} 行的请求头名称不能为空。`);
      continue;
    }
    const isValid = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name);
    if (!isValid) {
      addError(field, `第 ${row} 行的请求头名称格式无效。`);
      continue;
    }
    const normalizedName = name.toLowerCase();
    if (seen.has(normalizedName)) {
      addError(field, `第 ${row} 行的请求头名称重复。`);
      continue;
    }
    seen.add(normalizedName);
  }
}

function isValidOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  if (!INTEGER_PATTERN.test(trimmed)) {
    return false;
  }
  const number = Number(trimmed);
  return (
    Number.isSafeInteger(number) &&
    number >= -2_147_483_648 &&
    number <= 2_147_483_647
  );
}

function parseOptionalInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!INTEGER_PATTERN.test(trimmed)) {
    return null;
  }
  const number = Number.parseInt(trimmed, 10);
  return Number.isFinite(number) ? number : null;
}

function isValidRetryableFailureCooldownSecs(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return NON_NEGATIVE_INTEGER_PATTERN.test(trimmed);
}

function parseRetryableFailureCooldownSecs(value: string) {
  const trimmed = value.trim();
  if (!NON_NEGATIVE_INTEGER_PATTERN.test(trimmed)) {
    return 15;
  }
  const number = Number.parseInt(trimmed, 10);
  return Number.isFinite(number) ? number : 15;
}

const DEFAULT_SAME_UPSTREAM_RETRY_COUNT = 1;
const MAX_SAME_UPSTREAM_RETRY_COUNT = 5;

function isValidSameUpstreamRetryCount(value: string) {
  const trimmed = value.trim();
  if (!trimmed || !NON_NEGATIVE_INTEGER_PATTERN.test(trimmed)) {
    return false;
  }
  const number = Number.parseInt(trimmed, 10);
  return (
    Number.isFinite(number) &&
    number >= 0 &&
    number <= MAX_SAME_UPSTREAM_RETRY_COUNT
  );
}

function parseSameUpstreamRetryCount(value: string) {
  const trimmed = value.trim();
  if (!NON_NEGATIVE_INTEGER_PATTERN.test(trimmed)) {
    return DEFAULT_SAME_UPSTREAM_RETRY_COUNT;
  }
  const number = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(number)) {
    return DEFAULT_SAME_UPSTREAM_RETRY_COUNT;
  }
  if (number < 0 || number > MAX_SAME_UPSTREAM_RETRY_COUNT) {
    return DEFAULT_SAME_UPSTREAM_RETRY_COUNT;
  }
  return number;
}

function isValidTimeoutSecs(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (!NON_NEGATIVE_INTEGER_PATTERN.test(trimmed)) {
    return false;
  }
  const number = Number.parseInt(trimmed, 10);
  return Number.isFinite(number) && number >= MIN_TIMEOUT_SECS;
}

function parseTimeoutSecs(value: string, fallback: number) {
  const trimmed = value.trim();
  if (!NON_NEGATIVE_INTEGER_PATTERN.test(trimmed)) {
    return fallback;
  }
  const number = Number.parseInt(trimmed, 10);
  return Number.isFinite(number) ? number : fallback;
}

function isPositiveInteger(value: string) {
  return POSITIVE_INTEGER_PATTERN.test(value.trim());
}

function parsePositiveInteger(value: string, fallback: number) {
  const trimmed = value.trim();
  if (!POSITIVE_INTEGER_PATTERN.test(trimmed)) {
    return fallback;
  }
  const number = Number.parseInt(trimmed, 10);
  return Number.isFinite(number) ? number : fallback;
}

function isValidMinParallel(value: string) {
  const parsed = parsePositiveInteger(value, 0);
  return parsed >= MIN_PARALLEL_ATTEMPTS;
}

function parseMinParallel(value: string, fallback: number) {
  const parsed = parsePositiveInteger(value, fallback);
  return parsed >= MIN_PARALLEL_ATTEMPTS ? parsed : fallback;
}
