import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,Plus} from 'lucide-react';
import type {Connection} from './api';
import {CustomProviders} from './CustomProviders';
import {ProviderMark} from './ProviderMark';
import {customProvidersChanged,setCustomAccount,useCustomAccount,useCustomAccountsState} from './custom-account';
import {useLanguage} from './i18n';
import type {ProviderModel} from '../server/provider-model';
import './header-model-menu.css';

type Provider='claude'|'codex'|'copilot';
const names:Record<Provider,string>={claude:'Claude',codex:'Codex',copilot:'Copilot'};

/**
 * The chat header's model chip, after Strata: the provider and model of this chat, and one menu grouped into
 * providers, API connections (the local model among them) and the models of the chosen provider.
 * The models come from the provider's own catalog; a chat that has started keeps its provider.
 */
export function HeaderModelMenu({connection,provider,onProvider,models,model,onModel,disabled}:{
  connection:Connection;provider:Provider;onProvider?(value:Provider):void;
  models:ProviderModel[];model:string;onModel(value:string):void;disabled?:boolean;
}){
  const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
  const [open,setOpen]=useState(false),[manage,setManage]=useState(false),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
  const {accounts}=useCustomAccountsState(connection),account=useCustomAccount(),active=provider==='claude'?accounts.find(a=>a.id===account):undefined;
  const current=models.find(item=>item.id===model)||(!model?models.find(item=>item.isDefault)||(models.length===1?models[0]:undefined):undefined);
  const modelName=current?.name||model||(provider==='copilot'?'Auto':l('Default','По умолчанию'));
  const label=(active?.name||names[provider])+' · '+modelName;
  useEffect(()=>{if(!open)return;menu.current?.querySelector<HTMLElement>('[aria-checked=true],[role^=menuitem]')?.focus();
    const close=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
  const keys=(event:React.KeyboardEvent)=>{
    if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();
    const items=[...menu.current!.querySelectorAll<HTMLElement>('[role^=menuitem]:not(:disabled)')],at=items.indexOf(document.activeElement as HTMLElement);
    items[event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();
  };
  const choose=(action:()=>void)=>{action();setOpen(false);trigger.current?.focus({preventScroll:true});};
  const rect=trigger.current?.getBoundingClientRect(),width=320,left=Math.max(8,Math.min(rect?.left||8,window.innerWidth-width-8)),top=(rect?.bottom||0)+6;
  return <>
    <button ref={trigger} type="button" className="header-model-chip" disabled={disabled} aria-haspopup="menu" aria-expanded={open} aria-label={l('Provider and model: ','Провайдер и модель: ')+label} title={label}
      onClick={()=>{if(!open)customProvidersChanged();setOpen(value=>!value);}}><ProviderMark provider={active?'custom':provider}/><span>{label}</span><ChevronDown size={14} aria-hidden="true"/></button>
    {open&&createPortal(<div ref={menu} className="header-model-menu" role="menu" aria-label={l('Provider and model','Провайдер и модель')} style={{left,top,width,maxHeight:Math.max(160,window.innerHeight-top-12)}} onKeyDown={keys}>
      {onProvider&&<><p className="header-model-group" role="presentation">{l('Providers','Провайдеры')}</p>
        {(Object.keys(names) as Provider[]).map(id=>{const checked=provider===id&&!active;return <button key={id} type="button" role="menuitemradio" aria-checked={checked} onClick={()=>choose(()=>{setCustomAccount('');onProvider(id);})}><ProviderMark provider={id}/><span>{names[id]}</span>{checked&&<Check size={15} aria-hidden="true"/>}</button>;})}
        {accounts.length>0&&<p className="header-model-group" role="presentation">{l('API connections and local models','API-подключения и локальные модели')}</p>}
        {accounts.map(a=><button key={a.id} type="button" role="menuitemradio" aria-checked={active?.id===a.id} onClick={()=>choose(()=>{setCustomAccount(a.id);onProvider('claude');})}><ProviderMark provider="custom"/><span><strong>{a.name}</strong>{!a.hasKey&&<small>{l('No API key','Нет API-ключа')}</small>}</span>{active?.id===a.id&&<Check size={15} aria-hidden="true"/>}</button>)}
      </>}
      {models.length>0&&<><p className="header-model-group" role="presentation">{l('Models','Модели')} · {active?.name||names[provider]}</p>
        {models.map(item=>{const checked=item.id===current?.id;return <button key={item.id} type="button" role="menuitemradio" aria-checked={checked} title={item.resolvedModel||item.id} onClick={()=>choose(()=>onModel(item.id))}><span><strong>{item.name}</strong>{item.description&&<small>{item.description}</small>}</span>{checked&&<Check size={15} aria-hidden="true"/>}</button>;})}</>}
      <button type="button" role="menuitem" className="header-model-manage" onClick={()=>choose(()=>setManage(true))}><Plus size={16} aria-hidden="true"/><span>{l('Manage API models','Управление API-моделями')}</span></button>
    </div>,document.body)}
    {manage&&<CustomProviders connection={connection} onClose={()=>setManage(false)}/>}
  </>;
}
