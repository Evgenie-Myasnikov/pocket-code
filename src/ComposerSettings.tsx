import {t,useLanguage} from './i18n';
import {useComposerPreferences,saveComposerPreferences,enterSends,approvalTimeout,type ApprovalTimeout} from './composer-preferences';

/** Sending and approval behaviour, shared by the phone settings and the Windows window. */
export function ComposerSettings({desktop}:{desktop:boolean}){
  useLanguage();
  const stored=useComposerPreferences(),timeout=approvalTimeout(stored);
  return <section className="composer-settings" aria-label={t('Сообщения и подтверждения')}>
    <label className="desktop-toggle"><input type="checkbox" checked={enterSends(stored,desktop)} onChange={event=>saveComposerPreferences({enterSends:event.target.checked})}/>{t('Enter отправляет, Shift+Enter — новая строка')}</label>
    <p className="muted">{t('Без этой настройки сообщение отправляется по Ctrl+Enter.')}</p>
    <label>{t('Ожидание ответа на запрос разрешения')}<select value={timeout} onChange={event=>saveComposerPreferences({approvalTimeout:Number(event.target.value) as ApprovalTimeout})}>
      <option value={0}>{t('Без ограничения')}</option><option value={10}>{t('10 минут')}</option><option value={60}>{t('1 час')}</option>
    </select></label>
    <p className="muted">{timeout?t('Если не ответить вовремя, агент получит отказ, а в чате появится отметка об этом.'):t('Запрос ждёт вашего ответа, пока задача не остановлена. Ожидающая задача занимает один из трёх слотов сервера.')} {t('Применяется к следующему сообщению.')}</p>
  </section>;
}
