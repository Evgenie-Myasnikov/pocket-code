import type {Connection} from './api';
import './visual-system.css';
import { t, useLanguage } from "./i18n";import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { RotateCcw } from 'lucide-react';
import { Notice } from './Notice';
import './appearance.css';
import './neutral-themes.css';
import './contrast-modes.css';
import './setting-rows.css';

type Swatch = { dark: [string, string]; light: [string, string] };
type Palette = { id: string; name: string; hue: number; hslHue: number; swatch: Swatch; preferredTheme?: 'dark' | 'light' };
export const palettes: Palette[] = [
{ id: 'carbon', name: 'Карбон', hue: 0, hslHue: 0, preferredTheme: 'dark', swatch: { dark: ['#0f0f0f', '#e5e5e5'], light: ['#ffffff', '#171717'] } },
{ id: 'emerald', name: 'Изумруд', hue: 165, hslHue: 158, preferredTheme: 'dark', swatch: { dark: ['#101417', '#3ecf9a'], light: ['#f4f7f6', '#17694f'] } },
{ id: 'graphite', name: 'Графит', hue: 78, hslHue: 38, preferredTheme: 'dark', swatch: { dark: ['#191917', '#efb864'], light: ['#f6f4ef', '#77531d'] } },
{ id: 'slate', name: 'Сланец', hue: 237, hslHue: 202, preferredTheme: 'dark', swatch: { dark: ['#202831', '#9dd4f4'], light: ['#eef3f7', '#285e7e'] } },
{ id: 'ink', name: 'Тушь', hue: 327, hslHue: 301, preferredTheme: 'light', swatch: { dark: ['#201d23', '#d6acd8'], light: ['#f8f5ef', '#713f70'] } }];

type Contrast = 'auto' | 'normal' | 'more';
type Appearance = {chatFont:'vscode'|'golos'|'manrope'|'system'|'installed';/** The family name of an installed font, for chatFont 'installed'. */customFont:string;/** Set once the person picks a font; Golos saved before that was the old default and becomes VS Code's fonts. */fontChosen?:boolean;chatAlign:'center'|'left'|'right';palette: string;theme: 'dark' | 'light' | 'system';textSize: number;scale: number;spacing: number;/** Space between transcript blocks (an action line, a paragraph, a result), px. */blockGap: number;/** How long a received text takes to appear in the chat, ms; 0 shows it at once. */textDelay: number;compact: boolean;contrast: Contrast;colorblind: boolean;};
const defaults: Appearance = { chatFont:'vscode',customFont:'',chatAlign:'center', palette: 'carbon', theme: 'dark', textSize: 14, scale: 100, spacing: 1.6, blockGap: 4, textDelay: 500, compact: false, contrast: 'auto', colorblind: false };
const storageKey = 'pocket-code-appearance-v1';
const bounded = (value: unknown, min: number, max: number, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
function load(): Appearance {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === null) return defaults;
    const data = JSON.parse(saved);
    // A palette that no longer exists (the removed colour palettes) becomes the default theme.
    const palette = palettes.some((p) => p.id === data.palette) ? data.palette : defaults.palette;
    return { chatFont:['golos','manrope','system','installed'].includes(data.chatFont)&&!(data.chatFont==='golos'&&!data.fontChosen)?data.chatFont:'vscode',customFont:typeof data.customFont==='string'?fontName(data.customFont):'',...(data.fontChosen===true?{fontChosen:true}:{}),chatAlign:['left','center','right'].includes(data.chatAlign)?data.chatAlign:'center', palette,
      theme: ['dark', 'light', 'system'].includes(data.theme) ? data.theme : defaults.theme,
      textSize: bounded(data.textSize, 8, 22, 14), scale: bounded(data.scale, 60, 130, 100),
      spacing: data.spacing === 1.85 ? 1.6 : bounded(data.spacing, 1.1, 2.2, 1.6), blockGap: [0, 4, 10].includes(data.blockGap) ? data.blockGap : 4, textDelay: [0, 300, 500, 1000].includes(data.textDelay) ? data.textDelay : 500, compact: data.compact === true,
      contrast: ['auto', 'normal', 'more'].includes(data.contrast) ? data.contrast : defaults.contrast, colorblind: false /* The setting was removed; a saved choice no longer applies. */ };
  } catch {return defaults;}
}
/** Second line of the settings index: what is set now, not what the page is about. */
export function appearanceSummary(value: Appearance) {
  const theme = value.theme === 'light' ? t("Светлая") : value.theme === 'system' ? t("Системная") : t("Тёмная");
  return [theme, t(palettes.find((p) => p.id === value.palette)?.name || ''), `${value.textSize} px`].filter(Boolean).join(' · ');
}
export function useAppearance(ownsDocument = true) {
  useEffect(()=>{if(!ownsDocument)return;const wheel=(event:WheelEvent)=>{if(event.ctrlKey||event.metaKey)event.preventDefault();};document.addEventListener('wheel',wheel,{passive:false,capture:true});return()=>document.removeEventListener('wheel',wheel,true);},[ownsDocument]);
  const [appearance, setAppearance] = useState(load);
  const [saveError, setSaveError] = useState('');
  useLayoutEffect(() => {
    if (!ownsDocument) return;
    const root = document.documentElement,system = matchMedia('(prefers-color-scheme: light)');
    const applyTheme = () => {root.dataset.theme = appearance.theme === 'system' ? system.matches ? 'light' : 'dark' : appearance.theme;};
    applyTheme();system.addEventListener('change', applyTheme);
    root.dataset.chatAlign = appearance.chatAlign;
    // One font for the interface and the conversation, as in Strata; VS Code's system fonts unless the person picks another.
    const family=fontFamily(appearance);
    if(family){root.style.setProperty('--font-sans',family);root.style.setProperty('--font-display',family);}else{root.style.removeProperty('--font-sans');root.style.removeProperty('--font-display');}
    root.style.setProperty('--font-chat','var(--font-sans)');
    root.dataset.compact = String(appearance.compact);
    root.dataset.palette = appearance.palette;
    const palette = palettes.find((p) => p.id === appearance.palette)!;
    root.style.setProperty('--palette-hue', String(palette.hue));root.style.setProperty('--palette-hsl-hue', String(palette.hslHue));
    // Automatic contrast leaves the attribute off so @media (prefers-contrast: more) can apply.
    if (appearance.contrast === 'auto') delete root.dataset.contrast; else root.dataset.contrast = appearance.contrast;
    root.dataset.colorblind = String(appearance.colorblind);
    root.style.setProperty('--chat-font-size', `${appearance.textSize}px`);
    root.style.setProperty('--ui-scale', String(appearance.scale / 100));
    root.style.setProperty('--chat-line-height', String(appearance.spacing));
    root.style.setProperty('--chat-block-gap', appearance.blockGap + 'px');
    root.dataset.textDelay = String(appearance.textDelay);
    try {localStorage.setItem(storageKey, JSON.stringify(appearance));setSaveError('');}
    catch {setSaveError(t("Настройки применены, но сохранить их на устройстве не удалось."));}
    return () => system.removeEventListener('change', applyTheme);
  }, [appearance, ownsDocument]);
  return { appearance, setAppearance, saveError };
}
/** A family name typed by the person: letters, digits, spaces, dots and hyphens only, so it cannot break out of CSS. */
function fontName(value:string){return value.replace(/[^\p{L}\p{N} .-]/gu,'').trim().slice(0,60);}
function fontFamily(value:Appearance){
  if(value.chatFont==='golos')return "'Golos Text',system-ui,sans-serif";
  if(value.chatFont==='manrope')return "'Manrope','Golos Text',sans-serif";
  if(value.chatFont==='system')return 'system-ui,sans-serif';
  if(value.chatFont==='installed'&&value.customFont)return `"${value.customFont}",-apple-system,"Segoe UI",system-ui,sans-serif`;
  return '';
}
type Sizing = Pick<Appearance, 'textSize' | 'scale' | 'spacing' | 'compact'>;
/** Three sizes cover most needs; the exact sliders (including the 8–22 px and 60–130 % extremes) stay under "More". */
const sizePresets: { id: string; title: string; value: Sizing }[] = [
  { id: 'compact', title: 'Компактно', value: { textSize: 13, scale: 90, spacing: 1.45, compact: true } },
  { id: 'standard', title: 'Стандарт', value: { textSize: defaults.textSize, scale: defaults.scale, spacing: defaults.spacing, compact: defaults.compact } },
  { id: 'large', title: 'Крупно', value: { textSize: 17, scale: 115, spacing: 1.95, compact: false } }];
const matchesPreset = (value: Appearance, preset: Sizing) => value.textSize === preset.textSize && value.scale === preset.scale && Math.abs(value.spacing - preset.spacing) < 0.001 && value.compact === preset.compact;
/** Appearance in a few flat rows: theme, mode, size and colour-blind colours. Each row is a title, a short note and one control. */
export function AppearanceSettings({ appearance, setAppearance, saveError }: ReturnType<typeof useAppearance>&{connection?:Connection|null}) {
  useLanguage();
  const [undo, setUndo] = useState<Appearance | null>(null), preset = sizePresets.find((item) => matchesPreset(appearance, item.value));
  useEffect(() => { if (!undo) return; const timer = setTimeout(() => setUndo(null), 10_000); return () => clearTimeout(timer); }, [undo]);
  const changed = (Object.keys(defaults) as (keyof Appearance)[]).some((key) => appearance[key] !== defaults[key]);
  function paletteButton(palette: Palette) {
    const selected = appearance.palette === palette.id;
    const [darkBg, darkAccent] = palette.swatch.dark, [lightBg, lightAccent] = palette.swatch.light;
    return <button type="button" key={palette.id} aria-pressed={selected} onClick={() => setAppearance((old) => ({ ...old, palette: palette.id }))}>
      <span className="palette-swatch" aria-hidden="true" style={{ '--swatch-dark-bg': darkBg, '--swatch-dark-accent': darkAccent, '--swatch-light-bg': lightBg, '--swatch-light-accent': lightAccent } as CSSProperties} />
      {t(palette.name)}{selected && <b aria-hidden="true">✓</b>}
    </button>;
  }
  return <section className="appearance-settings setting-rows" aria-label={t("Настройки интерфейса")}>
    <div className="setting-row" role="group" aria-labelledby="appearance-theme-title"><div><strong id="appearance-theme-title">{t("Тема")}</strong><small>{t("Цвета окна. Изменения видны сразу и сохраняются на этом устройстве.")}</small></div>
      <div className="palette-options theme-presets">{palettes.map(paletteButton)}</div></div>
    <div className="setting-row" role="radiogroup" aria-labelledby="appearance-mode-title"><div><strong id="appearance-mode-title">{t("Режим")}</strong><small>{t("Тёмный, светлый или как в системе.")}</small></div>
      <div className="segmented-options">{([['dark', 'Тёмная'], ['light', 'Светлая'], ['system', 'Системная']] as const).map(([id, title]) => <label key={id}><input type="radio" name="appearance-theme" value={id} checked={appearance.theme === id} onChange={() => setAppearance((p) => ({ ...p, theme: id }))} /><span>{t(title)}</span></label>)}</div></div>
    <div className="setting-row" role="radiogroup" aria-labelledby="appearance-size-title"><div><strong id="appearance-size-title">{t("Размер")}</strong><small>{t("Размер текста и элементов интерфейса.")}</small></div>
      <div className="segmented-options">{sizePresets.map((item) => <label key={item.id}><input type="radio" name="appearance-size" checked={preset?.id === item.id} onChange={() => setAppearance((p) => ({ ...p, ...item.value }))} /><span>{t(item.title)}</span></label>)}</div></div>
    <div className="setting-row"><div><strong id="appearance-font-title">{t("Шрифт")}</strong><small>{t("Шрифт интерфейса и чата.")}</small></div>
      <div className="appearance-font"><select aria-labelledby="appearance-font-title" value={appearance.chatFont} onChange={(e) => setAppearance((p) => ({ ...p, chatFont: e.target.value as Appearance['chatFont'], fontChosen: true }))}>
        <option value="vscode">{t("Как в VS Code (Segoe UI)")}</option><option value="golos">Golos Text</option><option value="manrope">Manrope</option><option value="system">{t("Системный")}</option><option value="installed">{t("Другой установленный…")}</option></select>
        {appearance.chatFont==='installed'&&<input aria-label={t("Название установленного шрифта")} placeholder="Inter" defaultValue={appearance.customFont} maxLength={60} onBlur={(e) => setAppearance((p) => ({ ...p, customFont: fontName(e.target.value) }))} onKeyDown={(e) => {if(e.key==='Enter')(e.target as HTMLInputElement).blur();}} />}</div></div>
    <div className="setting-row" role="radiogroup" aria-labelledby="appearance-gap-title"><div><strong id="appearance-gap-title">{t("Расстояние между блоками")}</strong><small>{t("Между строками действий, абзацами ответа и результатами в чате.")}</small></div>
      <div className="segmented-options">{([[0, 'Плотно'], [4, 'Обычно'], [10, 'Свободно']] as const).map(([value, title]) => <label key={value}><input type="radio" name="appearance-gap" checked={appearance.blockGap === value} onChange={() => setAppearance((p) => ({ ...p, blockGap: value }))} /><span>{t(title)}</span></label>)}</div></div>
    <div className="setting-row" role="radiogroup" aria-labelledby="appearance-delay-title"><div><strong id="appearance-delay-title">{t("Плавное появление текста")}</strong><small>{t("Текст, который пришёл сразу, появляется в чате по словам за это время.")}</small></div>
      <div className="segmented-options">{([[0, 'Сразу'], [300, '0,3 с'], [500, '0,5 с'], [1000, '1 с']] as const).map(([value, title]) => <label key={value}><input type="radio" name="appearance-delay" checked={appearance.textDelay === value} onChange={() => setAppearance((p) => ({ ...p, textDelay: value }))} /><span>{t(title)}</span></label>)}</div></div>
    {undo ? <Notice tone="info" action={<button type="button" className="secondary" onClick={() => { setAppearance({ ...undo }); setUndo(null); }}>{t("Отменить")}</button>}>{t("Оформление сброшено.")}</Notice>
      : <button type="button" className="text-button appearance-reset" disabled={!changed} onClick={() => { setUndo({ ...appearance }); setAppearance({ ...defaults }); }}><RotateCcw size={16} aria-hidden="true" />{t("Сбросить оформление")}</button>}
    {saveError && <p role="alert" className="error-banner">{t(saveError)}</p>}
  </section>;
}
