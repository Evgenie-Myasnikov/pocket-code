import {createPortal} from 'react-dom';
import {CustomProviders} from './CustomProviders';
import type {Connection} from './api';
import {useEffect,useRef,useState} from 'react';
import {ChevronDown,Check,Plus} from 'lucide-react';
import {ProviderMark} from './ProviderMark';
import {useLanguage} from './i18n';
import './provider-picker.css';
type Provider='claude'|'codex'|'copilot';
const names:Record<Provider,string>={claude:'Claude',codex:'Codex',copilot:'Copilot'};
export function ProviderPicker({value,onChange,disabled=false,attention=()=>0,onAdd,connection}:{value:Provider;onChange(value:Provider):void;disabled?:boolean;attention?:(value:Provider)=>number;onAdd?():void;connection?:Connection}){
 const [custom,setCustom]=useState(false),[open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),menu=useRef<HTMLDivElement>(null),ru=useLanguage()==='ru';
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)&&!menu.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 const keys=(e:React.KeyboardEvent)=>{e.stopPropagation();if(e.key==='Escape'){setOpen(false);root.current?.querySelector('button')?.focus();}if(open&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...menu.current!.querySelectorAll<HTMLButtonElement>('[role=menuitemradio],[role=menuitem]')];const at=items.indexOf(document.activeElement as HTMLButtonElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(at+(e.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();}};
 const rect=root.current?.getBoundingClientRect(),width=Math.max(180,rect?.width||180),left=Math.max(8,Math.min(rect?.left||8,window.innerWidth-width-8)),top=Math.max(8,Math.min((rect?.bottom||0)+4,window.innerHeight-220));
 return <div className="provider-picker" ref={root} onKeyDown={keys}>
  <button className="provider-picker-trigger" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)}><ProviderMark provider={value}/><strong>{names[value]}</strong>{attention(value)>0&&<span className="provider-count">{attention(value)}</span>}<ChevronDown size={16}/></button>
  {open&&createPortal(<div ref={menu} onKeyDown={keys} style={{position:'fixed',left,top,width,right:'auto',zIndex:'var(--z-menu)'}} className="provider-picker-menu" role="menu" aria-label={ru?'Провайдер':'Provider'}>{(Object.keys(names) as Provider[]).map(id=><button role="menuitemradio" aria-checked={value===id} key={id} onClick={()=>{onChange(id);setOpen(false);}}><ProviderMark provider={id}/><span>{names[id]}</span>{attention(id)>0&&<small>{attention(id)}</small>}{value===id&&<Check size={16}/>}</button>)}{(onAdd||connection)&&<button role="menuitem" className="provider-add" onClick={()=>{setOpen(false);if(onAdd)onAdd();else setCustom(true);}}><Plus size={17}/><span>{ru?'Свой провайдер…':'Custom provider…'}</span></button>}</div>,document.body)}
 {custom&&connection&&<CustomProviders connection={connection} onClose={()=>setCustom(false)}/>}
 </div>;
}
