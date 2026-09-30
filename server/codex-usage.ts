export type CodexUsageWindow = {
  id: 'primary' | 'secondary';
  usedPercent: number | null;
  remainingPercent: number | null;
  windowDurationMins: number | null;
  /** Unix timestamp in seconds, as returned by Codex. */
  resetsAt: number | null;
};
export type CodexUsageSnapshot = {
  checkedAt: number;
  ordinaryUsageAllowed: boolean | null;
  buckets: { id: string; name: string; windows: CodexUsageWindow[] }[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function positiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}
function percent(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}
function displayName(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && /^[\p{L}\p{N} ._()+-]{1,80}$/u.test(value) && !/^[\da-f]{8}-[\da-f-]{27,}$/i.test(value)) return value;
  }
  return 'Codex';
}
function window(value: unknown, id: CodexUsageWindow['id']): CodexUsageWindow {
  const raw = record(value), usedPercent = percent(raw?.usedPercent);
  const reset = positiveInteger(raw?.resetsAt);
  return {
    id, usedPercent, remainingPercent: usedPercent === null ? null : 100 - usedPercent,
    windowDurationMins: positiveInteger(raw?.windowDurationMins),
    resetsAt: reset !== null && reset <= 8_640_000_000_000 ? reset : null,
  };
}

/** Explicit allowlist: account IDs, credits, opaque banners and authentication data never leave this mapper. */
export function normalizeCodexUsage(value: unknown, checkedAt = Date.now()): CodexUsageSnapshot {
  const raw = record(value), multi = record(raw?.rateLimitsByLimitId);
  const entries = multi ? Object.entries(multi).filter(([, value]) => record(value)) : [];
  const legacy = record(raw?.rateLimits);
  const sources = entries.length ? entries : legacy ? [['Codex', legacy] as const] : [];
  return {
    checkedAt,
    ordinaryUsageAllowed: typeof raw?.ordinaryUsageAllowed === 'boolean' ? raw.ordinaryUsageAllowed : null,
    buckets: sources.slice(0, 30).flatMap(([key, value], index) => {
      const bucket = record(value)!;
      // An empty legacy snapshot means this account has no reported usage windows.
      if (!record(bucket.primary) && !record(bucket.secondary)) return [];
      return [{
        id: `bucket-${index + 1}`, name: displayName(bucket.limitName, bucket.normalModelSlug, key),
        windows: [window(bucket.primary, 'primary'), window(bucket.secondary, 'secondary')],
      }];
    }),
  };
}
