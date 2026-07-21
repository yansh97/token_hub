const DASHBOARD_TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
};

const DASHBOARD_TIME_MINUTE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
};

const LOCAL_CLIENT_IPS = new Set([
  "local",
  "localhost",
  "127.0.0.1",
  "::1",
  "0:0:0:0:0:0:0:1",
  "::ffff:127.0.0.1",
]);
const LOCAL_CLIENT_IP_LABEL = "本机";

function normalizeProviderPart(value: string | null | undefined) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim() ?? ""
  );
}

function isLocalProxyRequest(upstreamId: string, provider: string) {
  return (
    normalizeProviderPart(upstreamId) === "local" &&
    normalizeProviderPart(provider) === "proxy"
  );
}

function containsProviderPart(
  value: string | null | undefined,
  provider: string,
) {
  const normalizedValue = normalizeProviderPart(value);
  const normalizedProvider = normalizeProviderPart(provider);
  if (!normalizedValue || !normalizedProvider) {
    return false;
  }
  return normalizedValue.split(" ").includes(normalizedProvider);
}

export function createDashboardTimeFormatter(locale: string) {
  return new Intl.DateTimeFormat(locale, DASHBOARD_TIME_FORMAT_OPTIONS);
}

export function createDashboardMinuteFormatter(locale: string) {
  return new Intl.DateTimeFormat(locale, DASHBOARD_TIME_MINUTE_FORMAT_OPTIONS);
}

export function formatDashboardTimestamp(
  tsMs: number,
  formatter: Intl.DateTimeFormat,
) {
  const date = new Date(tsMs);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  if (!parts.year || !parts.month || !parts.day) {
    return formatter.format(date);
  }
  const datePart = [parts.year, parts.month, parts.day]
    .map((part, index) => (index === 0 ? part : part.padStart(2, "0")))
    .join("-");
  const timePart = [parts.hour, parts.minute, parts.second]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.padStart(2, "0"))
    .join(":");
  return timePart ? `${datePart} ${timePart}` : datePart;
}

function padClockPart(value: number) {
  return value.toString().padStart(2, "0");
}

export function formatDashboardClockTime(tsMs: number) {
  const date = new Date(tsMs);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return [
    padClockPart(date.getHours()),
    padClockPart(date.getMinutes()),
    padClockPart(date.getSeconds()),
  ].join(":");
}

export function formatDashboardProviderLabel(
  upstreamId: string,
  provider: string,
) {
  if (isLocalProxyRequest(upstreamId, provider)) {
    return "本地代理";
  }

  const trimmedProvider = provider.trim();
  const shouldHideProvider =
    trimmedProvider.length > 0 &&
    containsProviderPart(upstreamId, trimmedProvider);

  return [upstreamId.trim(), shouldHideProvider ? null : trimmedProvider]
    .filter(Boolean)
    .join(" · ");
}

export function formatDashboardClientIp(clientIp: string | null | undefined) {
  // 后端通常不落库本机 IPv4；兼容旧日志和 IPv6 loopback 的常见写法。
  const trimmed = clientIp?.trim();
  if (!trimmed || LOCAL_CLIENT_IPS.has(trimmed.toLowerCase())) {
    return LOCAL_CLIENT_IP_LABEL;
  }
  return trimmed;
}

// 使用逗号作为千位分隔符，便于阅读
export function formatInteger(value: number) {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 紧凑格式，用于空间有限的场景（如 985856 → 986K, 1500000 → 1.5M）
const COMPACT_FORMAT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCompact(value: number) {
  return COMPACT_FORMAT.format(value);
}

const COST_AMOUNT_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNanoUsdCost(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }
  return COST_AMOUNT_FORMAT.format(value / 1_000_000_000);
}
