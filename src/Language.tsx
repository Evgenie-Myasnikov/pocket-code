import { useId } from 'react';
import { setLanguage, t, useLanguage, type Language } from './i18n';
import { SettingRow } from './SettingsRows';

export function LanguageSelector({ row = false }: { row?: boolean } = {}) {
  const language = useLanguage(), id = useId();
  const select = <select id={row ? id : undefined} aria-label="Language / Язык" value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="ru">Русский</option></select>;
  if (row) return <SettingRow title={t('Язык интерфейса')} htmlFor={id} note={t('Текст чатов и файлов не переводится')}>{select}</SettingRow>;
  return <label className="language-picker">{t('Язык интерфейса')}{select}</label>;
}
