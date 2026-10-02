import type { CodexUsageSnapshot } from './codex-usage.js';

// Russian source strings are translation keys. Only premium requests and chat carry "Copilot",
// so the composer ring follows what CLI chats consume and ignores editor completions.
const names: Record<string, string> = { premium_interactions: 'Премиум-запросы Copilot', chat: 'Чат Copilot', completions: 'Автодополнения в редакторе' };
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Maps Copilot `account.getQuota` snapshots onto the shared usage format. */
export function copilotUsage(snapshots: Record<string, any> | undefined, now: number): CodexUsageSnapshot {
  const buckets: CodexUsageSnapshot['buckets'] = []; let ordinaryUsageAllowed: boolean | null = null;
  for (const id of Object.keys(names)) {
    const snapshot = snapshots?.[id];
    if (!snapshot || typeof snapshot !== 'object') continue;
    const unlimited = snapshot.isUnlimitedEntitlement === true || snapshot.entitlementRequests === -1;
    if (unlimited && id !== 'premium_interactions') continue;
    const entitlement = finite(snapshot.entitlementRequests), used = finite(snapshot.usedRequests), reported = finite(snapshot.remainingPercentage);
    // Counts are unambiguous; the reported percentage is only a fallback.
    const remaining = unlimited ? 100 : entitlement !== null && entitlement > 0 && used !== null ? (entitlement - used) / entitlement * 100 : reported;
    const percent = remaining === null ? null : Math.max(0, Math.min(100, remaining));
    const reset = typeof snapshot.resetDate === 'string' ? Date.parse(snapshot.resetDate) : NaN;
    if (id === 'premium_interactions' && percent === 0 && snapshot.usageAllowedWithExhaustedQuota === false && snapshot.overageAllowedWithExhaustedQuota !== true) ordinaryUsageAllowed = false;
    buckets.push({ id, name: names[id], windows: [{ id: 'primary', usedPercent: percent === null ? null : 100 - percent, remainingPercent: percent, windowDurationMins: null, resetsAt: Number.isFinite(reset) ? Math.floor(reset / 1000) : null }] });
  }
  return { checkedAt: now, ordinaryUsageAllowed, buckets };
}
