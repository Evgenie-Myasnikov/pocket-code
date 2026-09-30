import { setLanguage, t, useLanguage, type Language } from './i18n';

export function LanguageSelector() {
  const language = useLanguage();
  return <label className="language-picker">{t('Язык интерфейса')}<select aria-label="Language / Язык" value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="ru">Русский</option></select></label>;
}
