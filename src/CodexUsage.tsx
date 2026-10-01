import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { request, type Connection } from './api';
import { locale, t, useLanguage } from './i18n';
import type { CodexUsageSnapshot, CodexUsageWindow } from '../server/codex-usage';
import './codex-usage.css';

function windowLabel(window: CodexUsageWindow) {
  const minutes = window.windowDurationMins;
  if (minutes === null) return t(window.id === 'primary' ? 'Основное окно' : 'Дополнительное окно');
  const [unit, divisor] = minutes % 10080 === 0 ? ['week', 10080] : minutes % 1440 === 0 ? ['day', 1440] : minutes % 60 === 0 ? ['hour', 60] : ['minute', 1];
  return new Intl.NumberFormat(locale(), { style: 'unit', unit: unit as string, unitDisplay: 'long' }).format(minutes / Number(divisor));
}
const dateLabel = (milliseconds: number) => new Date(milliseconds).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });

export function CodexUsage({ connection, provider = 'codex' }: { connection: Connection | null; provider?: 'claude' | 'codex' | 'copilot' }) {
  useLanguage();
  const providerName = provider === 'claude' ? 'Claude' : 'Codex';
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
        if (active) setSnapshot(result);
      } catch { if (active) setFailed(true); }
      finally { pending = false; if (active) setBusy(false); }
    }
    refresh.current = () => { void load(); };
    void load();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000);
    return () => { active = false; clearInterval(interval); refresh.current = () => {}; };
  }, [connection?.url, connection?.token, provider]);

  return <section className="codex-usage" aria-label={t('Лимиты {0}', providerName)}>
    <div className="codex-usage-heading"><h3>{t('Лимиты {0}', providerName)}</h3><button className="icon-button" type="button" onClick={() => refresh.current()} disabled={!connection || busy} aria-label={t('Обновить лимиты')} title={t('Обновить лимиты')}><RefreshCw size={18}/></button></div>
    <p className="muted">{t('Общие лимиты аккаунта {0} на ПК — для всех чатов и устройств.', providerName)}</p>
    {!connection && <p>{t('Подключитесь к ПК, чтобы увидеть лимиты.')}</p>}
    {busy && !snapshot && <p role="status">{t('Загружаем лимиты…')}</p>}
    {failed && <p className="codex-usage-notice" role="status">{t('Не удалось обновить лимиты. Проверьте подключение и вход в {0} на ПК.', providerName)}</p>}
    {snapshot?.ordinaryUsageAllowed === false && <p className="codex-usage-notice">{t('{0} сообщает, что включённое в подписку использование сейчас недоступно.', providerName)}</p>}
    {snapshot && !snapshot.buckets.length && <><p>{t('{0} не передал данные о лимитах для этого аккаунта.', providerName)}</p>{provider === 'claude' && <p className="muted">{t('Для API-ключей и сторонних провайдеров лимиты подписки Claude недоступны.')}</p>}</>}
    {snapshot?.buckets.map(bucket => <div className="codex-usage-bucket" key={bucket.id}>
      <h4>{t(bucket.name)}</h4>
      <div className="codex-usage-windows">{bucket.windows.map(window => <div className="codex-usage-window" key={window.id}>
        <div className="codex-usage-window-heading"><span>{windowLabel(window)}</span><strong>{window.remainingPercent === null ? t('Нет данных') : t('Осталось {0}%', new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(window.remainingPercent))}</strong></div>
        {window.remainingPercent !== null && <progress max={100} value={window.remainingPercent} aria-label={t('Оставшийся лимит: {0}', windowLabel(window))}/>}
        <small>{window.resetsAt === null ? t('Время сброса неизвестно') : t('Сброс: {0}', dateLabel(window.resetsAt * 1000))}</small>
      </div>)}</div>
    </div>)}
    {snapshot && <p className="codex-usage-checked muted">{t('Проверено: {0}', dateLabel(snapshot.checkedAt))}{busy ? ` · ${t('Обновляем…')}` : ''}</p>}
  </section>;
}
