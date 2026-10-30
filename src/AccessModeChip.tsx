import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ShieldCheck,ShieldAlert,FilePen,ListChecks,Bot,ChevronDown} from 'lucide-react';
import {t,useLanguage} from './i18n';
import type {WorkspaceProvider} from './preferences';

/** Ask / Edits / Full / Plan for Claude; Ask / Auto-review / Full for Codex. Settings hold the default, this chip the chat's choice. */
export type AccessMode='default'|'acceptEdits'|'bypassPermissions'|'plan'|'ask'|'auto'|'full';
type Option={value:AccessMode;label:string;note:string;Icon:typeof ShieldCheck;danger?:boolean};
export function accessOptions(provider:WorkspaceProvider):Option[]{
  if(provider==='claude')return [
    {value:'default',label:t('Спрашивать'),note:t('Подтверждение для правок и команд'),Icon:ShieldCheck},
    {value:'acceptEdits',label:t('Правки'),note:t('Правки файлов без вопросов, команды — с подтверждением'),Icon:FilePen},
    {value:'bypassPermissions',label:t('Полный'),note:t('Без подтверждений: агент сам правит файлы и выполняет команды'),Icon:ShieldAlert,danger:true},
    {value:'plan',label:t('План'),note:t('Сначала план без изменений; вы утверждаете, как выполнять'),Icon:ListChecks}];
  if(provider==='codex')return [
    {value:'ask',label:t('Спрашивать'),note:t('Codex спрашивает, когда действию нужно подтверждение'),Icon:ShieldCheck},
    {value:'auto',label:t('Авто'),note:t('Запросы оценивает проверяющий Codex, папка проекта ограничена'),Icon:Bot},
    {value:'full',label:t('Полный'),note:t('Без подтверждений и песочницы'),Icon:ShieldAlert,danger:true}];
  return [];
}
const confirmedKey='pocket-code-full-access-confirmed';
const fullConfirmed=()=>{try{return localStorage.getItem(confirmedKey)==='1';}catch{return false;}};

export function AccessModeChip({provider,value,onChange,running=false,liveChange=false,disabled=false}:{provider:WorkspaceProvider;value:AccessMode;onChange(value:AccessMode):void;running?:boolean;liveChange?:boolean;disabled?:boolean}){
  useLanguage();
  const options=accessOptions(provider),current=options.find(option=>option.value===value)||options[0];
  const [open,setOpen]=useState(false),[confirming,setConfirming]=useState<AccessMode|null>(null),[place,setPlace]=useState<{left:number;bottom:number}>({left:8,bottom:80});
  const root=useRef<HTMLDivElement>(null),popup=useRef<HTMLDivElement>(null),menu=useId();
  useEffect(()=>{if(!open)return;
    const away=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node)&&!popup.current?.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);root.current?.querySelector<HTMLButtonElement>('.access-chip')?.focus();}};
    document.addEventListener('pointerdown',away);document.addEventListener('keydown',key,true);
    requestAnimationFrame(()=>popup.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
    const reposition=()=>{const rect=root.current?.getBoundingClientRect();if(rect)setPlace({left:Math.max(8,Math.min(rect.left,innerWidth-308)),bottom:Math.max(8,innerHeight-rect.top+6)});};
    window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);
    return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',key,true);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);};
  },[open]);
  if(!current)return null;
  const choose=(option:Option)=>{
    // The riskiest mode asks once per device before it is used.
    if(option.danger&&!fullConfirmed()&&confirming!==option.value){setConfirming(option.value);return;}
    if(option.danger)try{localStorage.setItem(confirmedKey,'1');}catch{/* Ask again next time. */}
    setConfirming(null);setOpen(false);onChange(option.value);root.current?.querySelector<HTMLButtonElement>('.access-chip')?.focus();
  };
  // Claude changes Ask/Edits/Plan inside a running turn; everything else applies to the next message.
  const pending=(option:Option)=>running&&!(liveChange&&option.value!=='bypassPermissions');
  return <div className="access-mode" ref={root}>
    <button type="button" className="access-chip" data-danger={current.danger||undefined} aria-haspopup="menu" aria-expanded={open} aria-controls={open?menu:undefined} aria-label={t('Режим доступа: {0}',current.label)} title={current.note} disabled={disabled}
      onClick={event=>{
        // The menu is fixed to the viewport so the composer's scrolling overlay never clips it.
        const rect=event.currentTarget.getBoundingClientRect();setPlace({left:Math.max(8,Math.min(rect.left,innerWidth-308)),bottom:Math.max(8,innerHeight-rect.top+6)});
        setConfirming(null);setOpen(value=>!value);}}>
      <current.Icon size={16} aria-hidden="true"/><span>{current.label}</span><ChevronDown size={14} aria-hidden="true"/>
    </button>
    {open&&createPortal(<div ref={popup} className="access-menu" id={menu} role="menu" aria-label={t('Режим доступа')} style={{left:place.left,bottom:place.bottom}}>
      {options.map(option=><button key={option.value} type="button" role="menuitemradio" aria-checked={option.value===value} data-danger={option.danger||undefined} onClick={()=>choose(option)}
        onKeyDown={event=>{const items=[...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]')||[])],index=items.indexOf(event.currentTarget);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}}}>
        <option.Icon size={20} aria-hidden="true"/><span><strong>{option.label}</strong><small>{confirming===option.value?t('Нажмите ещё раз, чтобы включить полный доступ для этого чата.'):option.note}{pending(option)&&option.value!==value?' · '+t('со следующего сообщения'):''}</small></span>
      </button>)}
    </div>,document.body)}
  </div>;
}
