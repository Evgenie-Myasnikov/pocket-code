import {useEffect,useState} from 'react';
import {ChevronRight,Plus,RefreshCw,KeyRound,Server,CheckCircle2,Loader2} from 'lucide-react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {Notice} from './Notice';
import {customProvidersChanged,setCustomAccount,useCustomAccount} from './custom-account';
import './provider-connections.css';

export type CustomStatus={state:'ready'|'unauthorized'|'no-key'|'unreachable'|'incompatible'|'error';models?:number;message?:string;checkedAt:number;agent?:'supported'|'unsupported'|'unknown'};
export type CustomProfile={id:string;name:string;url:string;hasKey:boolean;status?:CustomStatus};

const host=(url:string)=>{try{return new URL(url).host;}catch{return url;}};
export function customStatusLabel(p:CustomProfile){
  const s=p.status;if(!s)return p.hasKey?t('Ключ сохранён'):t('Ключ не задан');
  switch(s.state){
    case 'ready':return t('Подключён · моделей: {0}',s.models??0);
    case 'unauthorized':return t('Ключ отклонён провайдером');
    case 'no-key':return t('Требуется API-ключ');
    case 'unreachable':return t('Провайдер недоступен');
    case 'incompatible':return t('Нет OpenAI-совместимого /models');
    default:return t('Ошибка проверки');
  }
}

/** Load custom providers with a live key check. Shared by the list and the account page. */
function useCustomProfiles(connection:Connection|null,online:boolean){
  const [profiles,setProfiles]=useState<CustomProfile[]|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[checking,setChecking]=useState(false);
  useLanguage();
  useEffect(()=>{if(!connection||!online){setProfiles(null);return;}let live=true;setChecking(true);
    request<CustomProfile[]>(connection,'/custom-providers?check=1').then(list=>{if(live){setProfiles(list);setError('');}}).catch(e=>{if(live)setError((e as Error).message);}).finally(()=>{if(live)setChecking(false);});
    return()=>{live=false;};},[connection,online,revision]);
  return {profiles,error,checking,reload:()=>setRevision(v=>v+1)};
}

/** Rows for custom providers in the AI accounts list, after the built-in providers. */
export function CustomProviderList({connection,online=true,onOpen}:{connection:Connection|null;online?:boolean;onOpen(id:string|'new'):void}){
  const {profiles,error}=useCustomProfiles(connection,online);
  if(!connection||!online)return null;
  return <>{(profiles||[]).map(p=><button className="settings-category" key={p.id} aria-labelledby={'custom-provider-'+p.id} aria-describedby={'custom-provider-'+p.id+'-summary'} onClick={()=>onOpen(p.id)}>
      <span><strong id={'custom-provider-'+p.id}>{p.name}</strong><small id={'custom-provider-'+p.id+'-summary'}>{customStatusLabel(p)} · {host(p.url)}</small></span><ChevronRight size={20} aria-hidden="true"/></button>)}
    <button className="settings-category" onClick={()=>onOpen('new')}><span><strong><Plus size={16} aria-hidden="true"/> {t('Добавить свой провайдер')}</strong><small>{t('OpenAI-совместимый API: URL и API-ключ')}</small></span><ChevronRight size={20} aria-hidden="true"/></button>
    {error&&<Notice tone="error">{error}</Notice>}</>;
}

/** One custom provider account: status, sign-in with an API key, endpoint edits and removal, like the built-in providers. */
export function CustomProviderAccount({connection,online=true,id,onSaved,onRemoved}:{connection:Connection|null;online?:boolean;id:string|'new';onSaved(id:string):void;onRemoved():void}){
  const {profiles,error:loadError,checking,reload}=useCustomProfiles(connection,online),active=useCustomAccount();
  const profile=id==='new'?null:profiles?.find(p=>p.id===id)||null;
  const [name,setName]=useState(''),[url,setUrl]=useState(''),[key,setKey]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false),[confirmRemove,setConfirmRemove]=useState(false);
  useEffect(()=>{if(profile){setName(profile.name);setUrl(profile.url);}else if(id==='new'){setName('');setUrl('');}setKey('');setEditing(false);setConfirmRemove(false);setError('');},[id,profile?.id]);
  if(!connection||!online)return <p role="status">{t('Подключите сервер ПК для проверки провайдеров и входа.')}</p>;
  async function save(body:Record<string,unknown>,done?:(saved:string)=>void){setBusy(true);setError('');try{const saved=await request<{id:string}>(connection!,'/custom-providers',body);setKey('');setEditing(false);reload();customProvidersChanged();done?.(saved.id);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function remove(){setBusy(true);setError('');try{await request(connection!,'/custom-providers/remove',{id});if(active===id)setCustomAccount('');customProvidersChanged();onRemoved();}catch(e){setError((e as Error).message);setBusy(false);}}
  const keyField=<label className="custom-account-field">{t('API-ключ')}<input type="password" autoComplete="off" spellCheck={false} value={key} maxLength={8192} onChange={e=>setKey(e.target.value)} placeholder={profile?.hasKey?t('Новый ключ заменит сохранённый'):''}/></label>;
  const endpointFields=<><label className="custom-account-field">{t('Название')}<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><label className="custom-account-field">{t('Базовый URL API')}<input required type="url" placeholder="https://api.example.com/v1" value={url} onChange={e=>setUrl(e.target.value)}/></label></>;
  if(id==='new')return <section className="provider-connections provider-connections-single"><article className="provider-card">
    <form className="custom-account-form" onSubmit={e=>{e.preventDefault();void save({name,url,...(key?{key}:{})},onSaved);}}>{endpointFields}{keyField}
      <p className="muted">{t('OpenAI-совместимый API. Ключ хранится зашифрованным на ПК и не показывается после сохранения. Модели загружаются через /models.')}</p>
      <button className="primary" disabled={busy||!name.trim()||!url.trim()} type="submit">{busy?<Loader2 className="provider-spinner" size={16}/>:null}{t('Добавить и проверить')}</button></form>
    {error&&<Notice tone="error">{error}</Notice>}</article></section>;
  if(!profile)return <section className="provider-connections provider-connections-single">{loadError?<Notice tone="error">{loadError}</Notice>:profiles?<Notice tone="warning">{t('Провайдер не найден. Возможно, он удалён на другом устройстве.')}</Notice>:<p role="status">{t('Проверяем провайдер…')}</p>}</section>;
  const s=profile.status,ok=s?.state==='ready';
  return <section className="provider-connections provider-connections-single"><article className="provider-card">
    <header><h3>{profile.name}</h3><span className="muted">{host(profile.url)}</span><button className="icon-button" aria-label={t('Проверить провайдер')} title={t('Проверить провайдер')} disabled={busy||checking} onClick={reload}><RefreshCw size={20}/></button></header>
    <dl>
      <div><dt><Server size={16}/>{t('Сервер')}</dt><dd>{checking&&!s?t('Проверяем…'):s?.state==='unreachable'?t('Недоступен'):s?.state==='incompatible'?t('Нет OpenAI-совместимого /models'):s?t('Отвечает'):t('Не проверен')}</dd></div>
      <div><dt><KeyRound size={16}/>{t('Авторизация')}</dt><dd className={ok?'provider-ok':''}>{ok?<><CheckCircle2 size={16}/>{profile.hasKey?t('Ключ принят'):t('Ключ не требуется')}</>:s?.state==='unauthorized'?t('Ключ отклонён провайдером'):s?.state==='no-key'||!profile.hasKey&&s?.state!=='ready'?t('Требуется API-ключ'):t('Не проверена')}</dd></div>
      {ok&&<div><dt>{t('Модели')}</dt><dd>{s?.models??0}</dd></div>}
      {ok&&<div><dt>{t('Агент')}</dt><dd className={s?.agent==='supported'?'provider-ok':''}>{s?.agent==='supported'?<><CheckCircle2 size={16}/>{t('Работает как Claude Code')}</>:s?.agent==='unsupported'?t('Нет Anthropic API: доступен только API-чат'):t('Не проверен')}</dd></div>}
    </dl>
    {s?.state==='error'&&s.message&&<Notice tone="error">{s.message}</Notice>}
    {s?.state==='unreachable'&&<Notice tone="warning">{t('ПК не может связаться с провайдером. Проверьте URL, сеть или что локальный сервер запущен.')}</Notice>}
    <details className="disclosure" open={!ok}><summary>{profile.hasKey?t('Сменить ключ'):t('Войти с API-ключом')}</summary>
      <form className="custom-account-form" onSubmit={e=>{e.preventDefault();if(key)void save({id,key});}}>{keyField}
        <p className="muted">{t('Ключ передаётся на ПК, хранится там зашифрованным и проверяется запросом к /models.')}</p>
        <div className="provider-login-methods"><button className="primary" disabled={busy||!key} type="submit">{t('Сохранить ключ и проверить')}</button>{profile.hasKey&&<button className="secondary" type="button" disabled={busy} onClick={()=>void save({id,clearKey:true})}>{t('Удалить ключ')}</button>}</div></form></details>
    <details className="disclosure" open={editing} onToggle={e=>setEditing((e.target as HTMLDetailsElement).open)}><summary>{t('Название и адрес')}</summary>
      <form className="custom-account-form" onSubmit={e=>{e.preventDefault();void save({id,name,url});}}>{endpointFields}<button className="secondary" disabled={busy||!name.trim()||!url.trim()||name===profile.name&&url===profile.url} type="submit">{t('Сохранить')}</button></form></details>
    {!confirmRemove?<button className="secondary danger" disabled={busy} onClick={()=>setConfirmRemove(true)}>{t('Удалить провайдер')}</button>:<div className="confirm-inline" role="group" aria-label={t('Удалить провайдер')}><p>{t('Провайдер, его ключ и история API-чата будут удалены с ПК.')}</p><div className="confirm-inline-actions"><button className="primary danger" disabled={busy} onClick={()=>void remove()}>{t('Удалить')}</button><button className="secondary" disabled={busy} onClick={()=>setConfirmRemove(false)}>{t('Отмена')}</button></div></div>}
    <p className="muted">{t('Выберите этого провайдера в списке провайдеров рядом с Claude, Codex и Copilot: чаты работают как в Claude — с файлами проекта, инструментами, подтверждениями и историей, но через URL и ключ провайдера и его модели.')}</p>
    {error&&<Notice tone="error">{error}</Notice>}
  </article></section>;
}
