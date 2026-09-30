import { t } from "./i18n";import { useEffect, useState } from 'react';
import './appearance.css';

const palettes = [
{ id: 'sage', name: 'Шалфей', color: '#c3dda8', hue: 94 },
{ id: 'ocean', name: 'Океан', color: '#9fcfff', hue: 211 },
{ id: 'lilac', name: 'Сирень', color: '#d2b5ff', hue: 267 },
{ id: 'rose', name: 'Роза', color: '#f4b7c9', hue: 340 },
{ id: 'amber', name: 'Янтарь', color: '#f1cb89', hue: 38 },
{ id: 'mint', name: 'Мята', color: '#abe3da', hue: 170 }];

type Appearance = {palette: string;theme: 'dark' | 'light' | 'system';textSize: number;scale: number;spacing: number;compact: boolean;};
const defaults: Appearance = { palette: 'sage', theme: 'dark', textSize: 14, scale: 100, spacing: 1.85, compact: false };
const storageKey = 'pocket-code-appearance-v1';
const bounded = (value: unknown, min: number, max: number, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
function load(): Appearance {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return { palette: palettes.some((p) => p.id === data.palette) ? data.palette : defaults.palette,
      theme: ['dark', 'light', 'system'].includes(data.theme) ? data.theme : defaults.theme,
      textSize: bounded(data.textSize, 8, 22, 14), scale: bounded(data.scale, 60, 130, 100),
      spacing: bounded(data.spacing, 1.1, 2.2, 1.85), compact: data.compact === true };
  } catch {return defaults;}
}
export function useAppearance() {
  const [appearance, setAppearance] = useState(load);
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    const root = document.documentElement,system = matchMedia('(prefers-color-scheme: light)');
    const applyTheme = () => {root.dataset.theme = appearance.theme === 'system' ? system.matches ? 'light' : 'dark' : appearance.theme;};
    applyTheme();system.addEventListener('change', applyTheme);
    root.dataset.compact = String(appearance.compact);
    root.style.setProperty('--palette-hue', String(palettes.find((p) => p.id === appearance.palette)!.hue));
    root.style.setProperty('--chat-font-size', `${appearance.textSize}px`);
    root.style.setProperty('--ui-scale', String(appearance.scale / 100));
    root.style.setProperty('--chat-line-height', String(appearance.spacing));
    try {localStorage.setItem(storageKey, JSON.stringify(appearance));setSaveError('');}
    catch {setSaveError(t("Настройки применены, но сохранить их на устройстве не удалось."));}
    return () => system.removeEventListener('change', applyTheme);
  }, [appearance]);
  return { appearance, setAppearance, saveError };
}
export function AppearanceSettings({ appearance, setAppearance, saveError }: ReturnType<typeof useAppearance>) {
  return <section className="appearance-settings" aria-label={t("Настройки интерфейса")}>
    <div className="eyebrow">{t("ОФОРМЛЕНИЕ")}</div><h2>{t("Как удобно вам")}</h2><p className="muted">{t("Изменения видны сразу и сохраняются на этом устройстве.")}</p>
    <label>{t("Тема")}<select aria-label={t("Тема")} value={appearance.theme} onChange={(e) => setAppearance((p) => ({ ...p, theme: e.target.value as Appearance['theme'] }))}><option value="dark">{t("Тёмная")}</option><option value="light">{t("Светлая")}</option><option value="system">{t("Как на устройстве")}</option></select></label>
    <fieldset className="palette-field"><legend>{t("Цветовая палитра")}</legend><div className="palette-options">{palettes.map((p) => <button type="button" key={p.id} aria-pressed={appearance.palette === p.id} onClick={() => setAppearance((old) => ({ ...old, palette: p.id }))}><span style={{ background: p.color }} />{t(p.name)}{appearance.palette === p.id && <b aria-hidden="true">✓</b>}</button>)}</div></fieldset>
    <label>{t("Размер текста чата ")}<output>{appearance.textSize} px</output><input aria-label={t("Размер текста чата")} type="range" min="8" max="22" step="1" value={appearance.textSize} onChange={(e) => setAppearance((p) => ({ ...p, textSize: Number(e.target.value) }))} /></label>
    <label>{t("Масштаб интерфейса ")}<output>{appearance.scale}%</output><input aria-label={t("Масштаб интерфейса")} type="range" min="60" max="130" step="5" value={appearance.scale} onChange={(e) => setAppearance((p) => ({ ...p, scale: Number(e.target.value) }))} /></label>
    <label>{t("Межстрочный интервал ")}<output>{appearance.spacing.toFixed(2)}</output><input aria-label={t("Межстрочный интервал")} type="range" min="1.1" max="2.2" step="0.05" value={appearance.spacing} onChange={(e) => setAppearance((p) => ({ ...p, spacing: Number(e.target.value) }))} /></label>
    <label className="compact-toggle"><input type="checkbox" checked={appearance.compact} onChange={(e) => setAppearance((p) => ({ ...p, compact: e.target.checked }))} />{t("Компактные отступы")}</label>
    <div className="appearance-preview"><span className="eyebrow">{t("ПРИМЕР СООБЩЕНИЯ")}</span><p>{t("Так будет выглядеть ваш чат с Claude.")}</p><button type="button" className="primary" onClick={() => setAppearance({ ...defaults })}>{t("Сбросить оформление")}</button></div>
    {saveError && <p role="alert" className="error">{t(saveError)}</p>}
  </section>;
}
