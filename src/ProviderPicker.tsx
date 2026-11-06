import {createPortal} from 'react-dom';
import {CustomProviders} from './CustomProviders';
import type {Connection} from './api';
import {useEffect,useRef,useState} from 'react';
import {ChevronDown,Check,Plus} from 'lucide-react';
import {ProviderMark} from './ProviderMark';
import {useLanguage} from './i18n';
import {customProvidersChanged,setCustomAccount,useCustomAccount,useCustomAccountsState} from './custom-account';
import './provider-picker.css';
type Provider='claude'|'codex'|'copilot';
const names:Record<Provider,string>={claude:'Claude',codex:'Codex',copilot:'Copilot'};
export function ProviderPicker({value,onChange,disabled=false,attention=()=>0,onAdd,connection}:{value:Provider;onChange(value:Provider):void;disabled?:boolean;attention?:(value:Provider)=>number;onAdd?():void;connection?:Connection}){
 const [custom,setCustom]=useState(false),[open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),menu=useRef<HTMLDivElement>(null),ru=useLanguage()==='ru';
 // Custom providers run the Claude agent with their own URL and key; picking one keeps the Claude workspace.
 const {accounts,loaded}=useCustomAccountsState(connection),account=useCustomAccount(),active=value==='claude'?accounts.find(a=>a.id===account):undefined;
 // Until the list loads, a stored custom provider is still the one chats are filtered by: say so instead of showing Claude.
 const pending=value==='claude'&&Boolean(account)&&!active&&!loaded;
 // A provider removed on the PC falls back to the PC's own Claude sign-in.
 useEffect(()=>{if(loaded&&account&&!accounts.some(a=>a.id===account))setCustomAccount('');},[loaded,account,accounts]);
 const choose=(id:Provider)=>{setCustomAccount('');onChange(id);setOpen(false);};
 const chooseAccount=(id:string)=>{setCustomAccount(id);onChange('claude');setOpen(false);};
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)&&!menu.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 const keys=(e:React.KeyboardEvent)=>{e.stopPropagation();if(e.key==='Escape'){setOpen(false);root.current?.querySelector('button')?.focus();}if(open&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...menu.current!.querySelectorAll<HTMLButtonElement>('[role=menuitemradio],[role=menuitem]')];const at=items.indexOf(document.activeElement as HTMLButtonElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(at+(e.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();}};
 const rect=root.current?.getBoundingClientRect(),width=Math.max(180,rect?.width||180),left=Math.max(8,Math.min(rect?.left||8,window.innerWidth-width-8)),top=Math.max(8,Math.min((rect?.bottom||0)+4,window.innerHeight-220));
 return <div className="provider-picker" ref={root} onKeyDown={keys}>
  <button className="provider-picker-trigger" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={()=>{if(!open&&connection)customProvidersChanged();setOpen(!open);}}><ProviderMark provider={active||pending?'custom':value}/><strong>{active?.name||(pending?(ru?'Свой провайдер…':'Custom provider…'):names[value])}</strong>{attention(value)>0&&<span className="provider-count">{attention(value)}</span>}<ChevronDown size={16}/></button>
  {open&&createPortal(<div ref={menu} onKeyDown={keys} style={{position:'fixed',left,top,width,right:'auto',zIndex:'var(--z-menu)'}} className="provider-picker-menu" role="menu" aria-label={ru?'Провайдер':'Provider'}>{(Object.keys(names) as Provider[]).map(id=>{const checked=value===id&&!(id==='claude'&&(active||pending));return <button role="menuitemradio" aria-checked={checked} key={id} onClick={()=>choose(id)}><ProviderMark provider={id}/><span>{names[id]}</span>{attention(id)>0&&<small>{attention(id)}</small>}{checked&&<Check size={16}/>}</button>;})}{accounts.map(a=><button role="menuitemradio" aria-checked={active?.id===a.id} key={a.id} title={a.hasKey?undefined:(ru?'Нужен API-ключ: Настройки → AI accounts':'API key needed: Settings → AI accounts')} onClick={()=>chooseAccount(a.id)}><ProviderMark provider="custom"/><span>{a.name}</span>{!a.hasKey&&<small>{ru?'нет ключа':'no key'}</small>}{active?.id===a.id&&<Check size={16}/>}</button>)}{(onAdd||connection)&&<button role="menuitem" className="provider-add" onClick={()=>{setOpen(false);if(onAdd)onAdd();else setCustom(true);}}><Plus size={17}/><span>{ru?'Свой провайдер…':'Custom provider…'}</span></button>}</div>,document.body)}
 {custom&&connection&&<CustomProviders connection={connection} onClose={()=>setCustom(false)}/>}
 </div>;
}
