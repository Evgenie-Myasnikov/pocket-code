import { useSyncExternalStore } from 'react';
import { english } from './translations';

export type Language = 'en' | 'ru';
const storageKey = 'pocket-code-language-v1';
let language: Language = 'en';
try { if (localStorage.getItem(storageKey) === 'ru') language = 'ru'; } catch { /* Storage can be unavailable. */ }
const listeners = new Set<() => void>();
const catalog = Object.fromEntries(Object.entries(english).map(([ru, en]) => [ru.trim(), en.trim()]));
const reverse = new Map(Object.entries(catalog).map(([ru, en]) => [en, ru]));
function pattern(source: string) {
  const indices: number[] = [];
  const escaped = source.split(/(\{\d+\})/).map(part => {
    if (/^\{\d+\}$/.test(part)) { indices.push(Number(part.slice(1, -1))); return '([\\s\\S]*?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return { regex: new RegExp(`^${escaped}$`), indices };
}
const templates = Object.entries(catalog).filter(([ru]) => /\{\d+\}/.test(ru)).map(([ru, en]) => ({ ru, en, ruPattern: pattern(ru), enPattern: pattern(en) }));
function applyLanguage() { if (typeof document !== 'undefined') document.documentElement.lang = language; }
applyLanguage();
export const getLanguage = () => language;
export const locale = () => language === 'ru' ? 'ru-RU' : 'en-US';
export function setLanguage(value: Language) {
  language = value;
  try { localStorage.setItem(storageKey, value); } catch { /* Keep the selection for this session. */ }
  applyLanguage();
  listeners.forEach(listener => listener());
}
export function useLanguage() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getLanguage, () => 'en' as Language);
}
export function t(text: string, ...values: unknown[]): string {
  const core = text.trim();
  const key = reverse.get(core) || core;
  let translated = language === 'en' ? catalog[key] || core : key;
  if (!catalog[key] && !values.length) {
    for (const item of templates) {
      const source = language === 'en' ? item.ruPattern : item.enPattern;
      const match = source.regex.exec(core);
      if (!match) continue;
      const substitutions = new Map(source.indices.map((index, position) => [index, match[position + 1]]));
      translated = (language === 'en' ? item.en : item.ru).replace(/\{(\d+)\}/g, (token, index) => substitutions.get(Number(index)) ?? token);
      break;
    }
  }
  return text.slice(0, text.indexOf(core)) + translated.replace(/\{(\d+)\}/g, (match, index) => Number(index) < values.length ? String(values[Number(index)]) : match) + text.slice(text.indexOf(core) + core.length);
}
