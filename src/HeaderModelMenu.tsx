import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,Cpu,LoaderCircle,Play,Settings,Square} from 'lucide-react';
import {request,type Connection} from './api';
import type {LocalModelStatus} from './LocalModels';
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
export function HeaderModelMenu({connection,provider,onProvider,models,model,onModel,onManage,disabled}:{
  connection:Connection;provider:Provider;onProvider?(value:Provider):void;
  models:ProviderModel[];model:string;onModel(value:string):void;
  /** Settings → Providers: API connections are added there and the local model is started there. */onManage?():void;disabled?:boolean;
}){
  const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
  const [open,setOpen]=useState(false),[local,setLocal]=useState<LocalModelStatus|null>(null),[localError,setLocalError]=useState(''),[pending,setPending]=useState(''),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
  const {accounts}=useCustomAccountsState(connection),account=useCustomAccount(),active=provider==='claude'?accounts.find(a=>a.id===account):undefined;
  const current=models.find(item=>item.id===model)||(!model?models.find(item=>item.isDefault)||(models.length===1?models[0]:undefined):undefined);
  const modelName=current?.name||model||(provider==='copilot'?'Auto':l('Default','По умолчанию'));
  const label=(active?.name||names[provider])+' · '+modelName;
  // The local models (Strata) on this PC, read each time the menu opens; a PC without Strata shows none.
  // While a start or stop is in progress the status is read every two seconds, also with the menu closed.
  const job=local?.job?.state,moving=job==='starting'||job==='stopping'||!!pending;
  useEffect(()=>{if(!open&&!moving)return;let live=true,timer:ReturnType<typeof setTimeout>|undefined;
    const read=()=>request<LocalModelStatus>(connection,'/local-models').then(value=>{if(!live)return;setLocal(value);
      if(pending&&value.job.state==='ready'){customProvidersChanged();setPending('');}
      if(pending&&value.job.state==='error'){setLocalError(value.job.error||l('The model did not start.','Модель не запустилась.'));setPending('');}
      if(value.job.state==='starting'||value.job.state==='stopping'||pending)timer=setTimeout(read,2000);}).catch(()=>{if(live)setLocal(null);});
    void read();return()=>{live=false;clearTimeout(timer);};},[open,moving,pending,connection.url,connection.token]);
  // After a start the served connection is chosen for this chat as soon as it appears.
  useEffect(()=>{if(!pending&&local?.job?.state==='ready'&&starting.current&&onProvider){const name=starting.current.toLowerCase();const served=accounts.find(a=>a.name.toLowerCase().includes(name));if(served){starting.current='';setCustomAccount(served.id);onProvider('claude');}}},[pending,local?.job?.state,accounts]);
  const starting=useRef('');
  function startLocal(id:string,name:string){
    let choice:{context?:number;drafting?:string}={};try{choice=JSON.parse(localStorage.getItem('pocket.localModel.choice')||'{}')||{};}catch{/* The defaults below apply. */}
    setLocalError('');setPending(id);starting.current=name;
    void request(connection,'/local-models/start',{model:id,context:[32768,65536,131072,262144].includes(choice.context as number)?choice.context:131072,drafting:['auto','mtp','dflash2','off'].includes(choice.drafting as string)?choice.drafting:'auto'})
      .catch(e=>{setLocalError((e as Error).message);setPending('');starting.current='';});
  }
  function stopLocal(){setLocalError('');setPending('stop');void request(connection,'/local-models/stop',{}).catch(e=>setLocalError((e as Error).message)).finally(()=>setPending(''));}
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
        {accounts.some(a=>!(local?.available&&/^strata\b/i.test(a.name)))&&<p className="header-model-group" role="presentation">{l('API connections','API-подключения')}</p>}
        {accounts.filter(a=>!(local?.available&&/^strata\b/i.test(a.name))).map(a=><button key={a.id} type="button" role="menuitemradio" aria-checked={active?.id===a.id} onClick={()=>choose(()=>{setCustomAccount(a.id);onProvider('claude');})}><ProviderMark provider="custom"/><span><strong>{a.name}</strong>{!a.hasKey&&<small>{l('No API key','Нет API-ключа')}</small>}</span>{active?.id===a.id&&<Check size={15} aria-hidden="true"/>}</button>)}
      </>}
      {onProvider&&local?.available&&local.models.length>0&&<><p className="header-model-group" role="presentation">{l('Local models','Локальные модели')}</p>
        {local.models.map(item=>{
          const running=local.running.some(run=>run.name===item.name||run.name===item.id)||local.job.state==='ready'&&local.job.model===item.id;
          const busy=pending===item.id||(local.job.state==='starting'&&local.job.model===item.id);
          // A running model is served as the API connection "Strata · <model>"; choosing it picks that connection.
          const served=running?accounts.find(a=>a.name.toLowerCase().includes(item.name.toLowerCase())||a.name.toLowerCase().includes(item.id.toLowerCase())):undefined;
          const checked=!!served&&active?.id===served.id;
          const note=busy?l('Starting… the window stays usable','Запускается… можно продолжать'):running?(served?l('Running','Запущена'):l('Running · connecting…','Запущена · подключается…')):item.ready?l('Downloaded, not running','Скачана, не запущена'):l('Not downloaded · Strata downloads it','Не скачана · скачивается в Strata');
          return <div key={item.id} className="header-model-local" data-running={running||undefined}>
            <button type="button" role="menuitemradio" aria-checked={checked} disabled={busy||!item.ready&&!running} title={running?l('Use this model in the chat','Использовать в чате'):l('Start without the Strata window and use it','Запустить без окна Strata и выбрать')}
              onClick={()=>{if(served)choose(()=>{setCustomAccount(served.id);onProvider('claude');});else if(!running)startLocal(item.id,item.name);}}>
              {busy?<LoaderCircle size={16} className="tool-spinner" aria-hidden="true"/>:running?<Cpu size={16} aria-hidden="true"/>:<Play size={16} aria-hidden="true"/>}<span><strong>{item.name}</strong><small>{note}</small></span>{checked&&<Check size={15} aria-hidden="true"/>}</button>
            {running&&<button type="button" role="menuitem" className="header-model-stop" disabled={pending==='stop'||local.job.state==='stopping'} aria-label={l('Stop ','Остановить ')+item.name} title={l('Stop the local model and free its memory','Остановить модель и освободить память')} onClick={stopLocal}><Square size={14} aria-hidden="true"/></button>}
          </div>;})}
        {localError&&<p className="header-model-error" role="alert">{localError}</p>}
      </>}
      {models.length>0&&<><p className="header-model-group" role="presentation">{l('Models','Модели')} · {active?.name||names[provider]}</p>
        {models.map(item=>{const checked=item.id===current?.id;return <button key={item.id} type="button" role="menuitemradio" aria-checked={checked} title={item.resolvedModel||item.id} onClick={()=>choose(()=>onModel(item.id))}><span><strong>{item.name}</strong>{item.description&&<small>{item.description}</small>}</span>{checked&&<Check size={15} aria-hidden="true"/>}</button>;})}</>}
      {onManage&&<button type="button" role="menuitem" className="header-model-manage" onClick={()=>choose(onManage)}><Settings size={16} aria-hidden="true"/><span>{l('API connections and local models…','API-подключения и локальные модели…')}</span></button>}
    </div>,document.body)}
  </>;
}
