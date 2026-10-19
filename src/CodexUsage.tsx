import { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import { request, type Connection } from './api';
import { locale, t, useLanguage } from './i18n';
import type { CodexUsageSnapshot, CodexUsageWindow } from '../server/codex-usage';
import './codex-usage.css';
import {validRemaining} from './usage-summary';
import {durationLabel,fullDate,momentLabel,narrowestWindow,percentLabel,usagePace,usageTone} from './usage-format';
import {publishUsage} from './live-settings';
import {Notice} from './Notice';

export function windowLabel(window: CodexUsageWindow, provider: 'claude' | 'codex' | 'copilot') {
  const minutes = window.windowDurationMins;
  // Copilot quotas run for the account's monthly billing period rather than a rolling window.
  if (minutes === null) return t(provider === 'copilot' ? 'Расчётный период' : window.id === 'primary' ? 'Основное окно' : 'Дополнительное окно');
  const [unit, divisor] = minutes % 10080 === 0 ? ['week', 10080] : minutes % 1440 === 0 ? ['day', 1440] : minutes % 60 === 0 ? ['hour', 60] : ['minute', 1];
  return new Intl.NumberFormat(locale(), { style: 'unit', unit: unit as string, unitDisplay: 'long' }).format(minutes / Number(divisor));
}
/** "Resets in 1 h 48 min · today at 00:55"; the full date stays in the title. */
export const resetLabel = (resetsAt: number, now = Date.now()) => t('Сброс через {0} · {1}', durationLabel(resetsAt * 1000 - now), momentLabel(resetsAt * 1000, now));

export function CodexUsage({ connection, provider = 'codex' }: { connection: Connection | null; provider?: 'claude' | 'codex' | 'copilot' }) {
  useLanguage();
  const providerName = provider === 'claude' ? 'Claude' : provider === 'copilot' ? 'GitHub Copilot' : 'Codex';
  const [snapshot, setSnapshot] = useState<CodexUsageSnapshot | null>(null);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true, pending = false;
    setSnapshot(null); setFailed(false); setBusy(false);
    if (!connection) { refresh.current = () => {}; return; }
    async function load() {
      if (!active || pending) return;
      pending = true; setBusy(true); setFailed(false);
      try {
        const result = await request<CodexUsageSnapshot>(connection!, `/${provider}/usage`);
        if (active) { setSnapshot(result); publishUsage(provider, result); }
      } catch { if (active) setFailed(true); } // The last dated read stays; validRemaining turns it into "No data" once it is older than two minutes.
      finally { pending = false; if (active) setBusy(false); }
    }
    refresh.current = () => { void load(); };
    void load();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000);
    return () => { active = false; clearInterval(interval); refresh.current = () => {}; };
  }, [connection?.url, connection?.token, provider]);
  // Each minute's poll re-renders, so relative reset times stay current without another timer.
  const now = Date.now(), narrowest = narrowestWindow(snapshot, now), windowCount = Array.isArray(snapshot?.buckets) ? snapshot!.buckets.reduce((sum, bucket) => sum + bucket.windows.length, 0) : 0;
  const paced = Array.isArray(snapshot?.buckets) && snapshot!.buckets.some(bucket => bucket.windows.some(window => window.windowDurationMins && window.resetsAt !== null));

  return <section className="codex-usage" aria-label={t('Лимиты {0}', providerName)}>
    <div className="codex-usage-heading"><h3>{t('Лимиты {0}', providerName)}</h3><button className="icon-button" type="button" onClick={() => refresh.current()} disabled={!connection || busy} aria-label={t('Обновить лимиты')} title={t('Обновить лимиты')}><RefreshCw size={18}/></button></div>
    <p className="muted">{t('Общие лимиты аккаунта {0} на ПК — для всех чатов и устройств.', providerName)}</p>
    {!connection && <p>{t('Подключитесь к ПК, чтобы увидеть лимиты.')}</p>}
    {busy && !snapshot && <p role="status">{t('Загружаем лимиты…')}</p>}
    {failed && <Notice tone="warning">{t('Не удалось обновить лимиты. Проверьте подключение и вход в {0} на ПК.', providerName)}</Notice>}
    {snapshot?.ordinaryUsageAllowed === false && <Notice tone="error">{t('{0} сообщает, что включённое в подписку использование сейчас недоступно.', providerName)}</Notice>}
    {snapshot && !snapshot.buckets.length && <><p>{t('{0} не передал данные о лимитах для этого аккаунта.', providerName)}</p>{provider === 'claude' && <p className="muted">{t('Для API-ключей и сторонних провайдеров лимиты подписки Claude недоступны.')}</p>}</>}
    {snapshot?.buckets.map(bucket => <div className="codex-usage-bucket" key={bucket.id}>
      <h4>{t(bucket.name)}</h4>
      <div className="codex-usage-windows">{bucket.windows.map(window => {
        const remaining = validRemaining(window, snapshot.checkedAt, now), tone = remaining === null ? null : usageTone(remaining), pace = remaining === null ? null : usagePace(window, remaining, now), Icon = tone === 'danger' ? AlertCircle : tone === 'warning' ? AlertTriangle : null;
        return <div className={'codex-usage-window' + (tone ? ' usage-tone-' + tone : '')} key={window.id}>
          <div className="codex-usage-window-heading"><span>{windowLabel(window, provider)}</span><strong>{Icon && <Icon size={15} aria-hidden="true"/>}{remaining === null ? t('Нет данных') : t('Осталось {0}%', percentLabel(remaining))}</strong></div>
          {windowCount > 1 && narrowest?.window === window && <span className="codex-usage-closest">{t('Ближе всего к лимиту')}</span>}
          {remaining !== null && <div className="codex-usage-bar"><progress max={100} value={remaining} aria-label={t('Оставшийся лимит: {0}', windowLabel(window, provider))}/>{pace && <span className="codex-usage-pace-marker" style={{ insetInlineStart: `${Math.round((1 - pace.elapsed) * 1000) / 10}%` }} aria-hidden="true"/>}</div>}
          {pace?.ahead && <small className="codex-usage-pace"><TrendingUp size={14} aria-hidden="true"/>{pace.runsOutAt ? t('Опережаете темп · при таком расходе закончится ≈ {0}', momentLabel(pace.runsOutAt, now)) : t('Опережаете темп')}</small>}
          <small title={window.resetsAt === null ? undefined : fullDate(window.resetsAt * 1000)}>{window.resetsAt === null ? t('Время сброса неизвестно') : resetLabel(window.resetsAt, now)}</small>
        </div>;
      })}</div>
    </div>)}
    {snapshot && <p className="codex-usage-checked muted">{t('Проверено: {0}', fullDate(snapshot.checkedAt))}{busy ? ` · ${t('Обновляем…')}` : ''}</p>}
    {snapshot && paced && <p className="muted codex-usage-legend">{t('Метка на полосе показывает, какая часть окна ещё впереди. Темп — оценка по данным провайдера.')}</p>}
  </section>;
}
