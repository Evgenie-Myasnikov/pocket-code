import { t, useLanguage } from "./i18n";import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Notice } from './Notice';
import { useStreamSpeed, setStreamSpeed } from './stream-speed';
import { useEdgeFade, setEdgeFade } from './chat-edge-fade';
import { useBoardGrid, setBoardGrid } from './board-grid';
import './appearance.css';
import './neutral-themes.css';
import {BoardGridSettings} from './BoardGridSettings';
import {StreamSpeedSettings} from './StreamSpeedSettings';
import {EdgeFadeSettings} from './EdgeFadeSettings';
import {useApplyEdgeFade} from './chat-edge-fade';

const palettes = [
{ id: 'neutral', name: 'Нейтральная', color: '#a6a6a6', hue: 0 },
{ id: 'codex', name: 'Codex', color: '#e5e5e5', hue: 0 },
{ id: 'claude', name: 'Claude', color: '#ce967b', hue: 25 },
{ id: 'copilot', name: 'Copilot', color: '#8db3ff', hue: 215 },
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
/** Second line of the settings index: what is set now, not what the page is about. */
export function appearanceSummary(value: Appearance) {
  const theme = value.theme === 'light' ? t("Светлая") : value.theme === 'system' ? t("Системная") : t("Тёмная");
  return [theme, t(palettes.find((p) => p.id === value.palette)?.name || ''), `${value.textSize} px`].filter(Boolean).join(' · ');
}
export function useAppearance() {
  useApplyEdgeFade();
  const [appearance, setAppearance] = useState(load);
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    const root = document.documentElement,system = matchMedia('(prefers-color-scheme: light)');
    const applyTheme = () => {root.dataset.theme = appearance.theme === 'system' ? system.matches ? 'light' : 'dark' : appearance.theme;};
    applyTheme();system.addEventListener('change', applyTheme);
    root.dataset.compact = String(appearance.compact);
    root.dataset.palette = appearance.palette;
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
type Sizing = Pick<Appearance, 'textSize' | 'scale' | 'spacing' | 'compact'>;
/** Three sizes cover most needs; the exact sliders (including the 8–22 px and 60–130 % extremes) stay under "More". */
const sizePresets: { id: string; title: string; value: Sizing }[] = [
  { id: 'compact', title: 'Компактно', value: { textSize: 13, scale: 90, spacing: 1.6, compact: true } },
  { id: 'standard', title: 'Стандарт', value: { textSize: defaults.textSize, scale: defaults.scale, spacing: defaults.spacing, compact: defaults.compact } },
  { id: 'large', title: 'Крупно', value: { textSize: 17, scale: 115, spacing: 1.95, compact: false } }];
const matchesPreset = (value: Appearance, preset: Sizing) => value.textSize === preset.textSize && value.scale === preset.scale && Math.abs(value.spacing - preset.spacing) < 0.001 && value.compact === preset.compact;
type Snapshot = { appearance: Appearance; speed: number; fade: number; grid: number };
/** One slider row: a dot and its own reset appear once the value differs from the default. */
function SliderRow({ label, output, changed, onReset, children }: { label: string; output: string; changed: boolean; onReset(): void; children: ReactNode }) {
  return <div className={'appearance-row' + (changed ? ' changed' : '')}><label>{changed && <span className="appearance-changed-dot" aria-hidden="true" />}{t(label)}<output>{output}</output>{children}</label>{changed && <button type="button" className="text-button appearance-reset-one" aria-label={t('Вернуть по умолчанию: {0}', t(label))} title={t('Вернуть по умолчанию: {0}', t(label))} onClick={onReset}><RotateCcw size={16} aria-hidden="true" /></button>}</div>;
}
export function AppearanceSettings({ appearance, setAppearance, saveError }: ReturnType<typeof useAppearance>) {
  useLanguage();
  const speed = useStreamSpeed(), fade = useEdgeFade(), grid = useBoardGrid();
  const [undo, setUndo] = useState<Snapshot | null>(null), preset = sizePresets.find((item) => matchesPreset(appearance, item.value));
  // "More" opens by itself when it holds a value that differs from the default, so custom settings are never hidden.
  const [advanced, setAdvanced] = useState(() => !preset || speed !== 40 || fade !== 100 || grid !== 8);
  useEffect(() => { if (!undo) return; const timer = setTimeout(() => setUndo(null), 10_000); return () => clearTimeout(timer); }, [undo]);
  const restore = (value: Snapshot) => { setAppearance({ ...value.appearance }); try { setStreamSpeed(value.speed); setEdgeFade(value.fade); setBoardGrid(value.grid); } catch { /* Appearance still applies; the save error explains storage problems. */ } };
  const changed = { textSize: appearance.textSize !== defaults.textSize, scale: appearance.scale !== defaults.scale, spacing: Math.abs(appearance.spacing - defaults.spacing) > 0.001 };
  const pageChanged = !matchesPreset(appearance, sizePresets[1].value) || appearance.theme !== defaults.theme || appearance.palette !== defaults.palette || speed !== 40 || fade !== 100 || grid !== 8;
  return <section className="appearance-settings" aria-label={t("Настройки интерфейса")}>
    <div className="appearance-preview" role="group" aria-label={t("Пример переписки")}>
      <div className="appearance-preview-user">{t("Почему падает тест входа?")}</div>
      <div className="appearance-preview-agent"><span className="eyebrow">{t("АГЕНТ")}</span><p>{t("Тест ждёт старый текст кнопки. Исправил ожидание:")}</p><code>expect(button).toHaveText('Sign in')</code></div>
      <div className="appearance-preview-tool"><span className="appearance-preview-dot" aria-hidden="true" />{t("Запускает npm test · 12 с")}</div>
    </div>
    <p className="muted">{t("Изменения видны сразу и сохраняются на этом устройстве.")}</p>
    <fieldset className="appearance-segmented"><legend>{t("Тема")}</legend><div className="segmented-options">{([['dark', 'Тёмная'], ['light', 'Светлая'], ['system', 'Системная']] as const).map(([id, title]) => <label key={id}><input type="radio" name="appearance-theme" value={id} checked={appearance.theme === id} onChange={() => setAppearance((p) => ({ ...p, theme: id }))} /><span>{t(title)}</span></label>)}</div></fieldset>
    <fieldset className="palette-field"><legend>{t("Цветовая палитра")}</legend><div className="palette-options">{palettes.map((p) => <button type="button" key={p.id} aria-pressed={appearance.palette === p.id} onClick={() => setAppearance((old) => ({ ...old, palette: p.id }))}><span style={{ background: p.color }} />{t(p.name)}{appearance.palette === p.id && <b aria-hidden="true">✓</b>}</button>)}</div></fieldset>
    <fieldset className="appearance-segmented"><legend>{t("Размер")}</legend><div className="segmented-options">{sizePresets.map((item) => <label key={item.id}><input type="radio" name="appearance-size" checked={preset?.id === item.id} onChange={() => setAppearance((p) => ({ ...p, ...item.value }))} /><span>{t(item.title)}</span></label>)}</div>{!preset && <p className="muted">{t("Сейчас выбраны свои значения в разделе «Дополнительно».")}</p>}</fieldset>
    <details className="disclosure appearance-advanced" open={advanced} onToggle={(event) => setAdvanced((event.currentTarget as HTMLDetailsElement).open)}><summary><ChevronDown className="disclosure-chevron" size={18} aria-hidden="true" />{t("Дополнительно")}</summary>
      <SliderRow label="Размер текста чата" output={`${appearance.textSize} px`} changed={changed.textSize} onReset={() => setAppearance((p) => ({ ...p, textSize: defaults.textSize }))}><input aria-label={t("Размер текста чата")} type="range" min="8" max="22" step="1" value={appearance.textSize} onChange={(e) => setAppearance((p) => ({ ...p, textSize: Number(e.target.value) }))} /></SliderRow>
      <SliderRow label="Масштаб интерфейса" output={`${appearance.scale}%`} changed={changed.scale} onReset={() => setAppearance((p) => ({ ...p, scale: defaults.scale }))}><input aria-label={t("Масштаб интерфейса")} type="range" min="60" max="130" step="5" value={appearance.scale} onChange={(e) => setAppearance((p) => ({ ...p, scale: Number(e.target.value) }))} /></SliderRow>
      <SliderRow label="Межстрочный интервал" output={appearance.spacing.toFixed(2)} changed={changed.spacing} onReset={() => setAppearance((p) => ({ ...p, spacing: defaults.spacing }))}><input aria-label={t("Межстрочный интервал")} type="range" min="1.1" max="2.2" step="0.05" value={appearance.spacing} onChange={(e) => setAppearance((p) => ({ ...p, spacing: Number(e.target.value) }))} /></SliderRow>
      <label className="compact-toggle"><input type="checkbox" checked={appearance.compact} onChange={(e) => setAppearance((p) => ({ ...p, compact: e.target.checked }))} />{t("Компактные отступы")}</label>
      <StreamSpeedSettings />
      <EdgeFadeSettings />
      <BoardGridSettings />
    </details>
    {undo ? <Notice tone="info" action={<button type="button" className="secondary" onClick={() => { restore(undo); setUndo(null); }}>{t("Отменить")}</button>}>{t("Оформление сброшено.")}</Notice>
      : <button type="button" className="text-button appearance-reset" disabled={!pageChanged} onClick={() => { setUndo({ appearance: { ...appearance }, speed, fade, grid }); restore({ appearance: { ...defaults }, speed: 40, fade: 100, grid: 8 }); }}><RotateCcw size={16} aria-hidden="true" />{t("Сбросить оформление")}</button>}
    {saveError && <p role="alert" className="error">{t(saveError)}</p>}
  </section>;
}
