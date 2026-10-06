import {useEffect, useState} from 'react';
import {request, type Connection} from './api';
import {t, useLanguage} from './i18n';
import {claudeFallbackModels as aliases, validModelId, type ProviderModel} from '../server/provider-model';
import type {WorkspaceProvider} from './preferences';
import './model-picker.css';

export function useClaudeModels(connection: Connection | null, provider: WorkspaceProvider, cwd: string) {
  const key = JSON.stringify([connection?.url, connection?.token, provider, cwd]);
  const [state, setState] = useState<{key: string; models: ProviderModel[]; unavailable: boolean}>();
  useEffect(() => {
    if (!connection || provider !== 'claude' || !cwd) return;
    let active = true;
    void request<{models: ProviderModel[]; source: string}>(connection, '/claude/models?cwd=' + encodeURIComponent(cwd))
      .then(value => {if (active) setState({key, models: value.models.filter(item => validModelId(item.id)), unavailable: value.source !== 'sdk'});})
      .catch(() => {if (active) setState({key, models: aliases, unavailable: true});});
    return () => {active = false;};
  }, [key]);
  return state?.key === key ? state : {models: aliases, unavailable: false};
}

export function ModelPicker({provider, name, models = [], value, onChange, disabled, unavailable}: {
  provider: WorkspaceProvider; name: string; models?: ProviderModel[]; value: string;
  onChange(value: string): void; disabled?: boolean; unavailable?: boolean;
}) {
  const ru = useLanguage() === 'ru';
  const [custom, setCustom] = useState(false), [draft, setDraft] = useState(value);
  useEffect(() => {setCustom(false);setDraft(value);}, [provider, value]);
  const selected = models.find(item => item.id === value);
  const label = (model: ProviderModel) => model.name + (model.resolvedModel && model.id !== model.resolvedModel ? ` · ${model.resolvedModel}` : '');
  const defaultModel = models.find(item => item.isDefault) || (models.length === 1 ? models[0] : undefined);
  const defaultName = provider === 'copilot' ? 'Auto' : defaultModel ? label(defaultModel) : '—';
  return <div className="model-picker">
    <select aria-label={t('Модель {0}', name)} value={custom ? '__custom__' : value} disabled={disabled}
      title={selected?.resolvedModel || value || defaultName}
      onChange={event => {if (event.target.value === '__custom__') {setCustom(true);setDraft(value);} else onChange(event.target.value);}}>
      <option value="">{defaultName}</option>
      {models.map(model => <option key={model.id} value={model.id}>{label(model)}</option>)}
      {value && !selected && <option value={value}>{value}</option>}
      {provider === 'claude' && <option value="__custom__">{ru ? 'Другая версия…' : 'Other version…'}</option>}
    </select>
    {custom && <div className="model-custom">
      <label>{ru ? 'Точный ID модели Claude' : 'Exact Claude model ID'}<input aria-label="Claude model ID" value={draft} disabled={disabled} maxLength={200} onChange={event => setDraft(event.target.value)} placeholder="claude-…" /></label>
      <button type="button" disabled={disabled || !validModelId(draft.trim())} onClick={() => {onChange(draft.trim());setCustom(false);}}>{ru ? 'Применить' : 'Apply'}</button>
      <button type="button" onClick={() => setCustom(false)}>{ru ? 'Отмена' : 'Cancel'}</button>
    </div>}
    {unavailable && <span className="model-catalog-hint" title={ru ? 'Каталог Claude недоступен. Доступны псевдонимы и точный ID модели.' : 'Claude catalog is unavailable. Use an alias or an exact model ID.'} aria-label={ru ? 'Каталог моделей недоступен' : 'Model catalog unavailable'}>ⓘ</span>}
  </div>;
}
