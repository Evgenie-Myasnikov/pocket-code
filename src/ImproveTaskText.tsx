import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Sparkles} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import './improve-task-text.css';

type Provider='claude'|'codex'|'copilot';
const providerNames={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};
const fieldLabels={
  instructions:['Инструкции','Instructions'],context:['Контекст','Context'],title:['Название','Title'],
  description:['Описание','Description'],checklist:['Критерии приёмки','Acceptance criteria'],
};
export type ImproveScope={connection:Connection;cwd:string;provider?:Provider};
type Props=ImproveScope&{
  field:keyof typeof fieldLabels;value:string;context?:string;maxLength?:number;
  onApply(text:string):void;disabled?:boolean;compact?:boolean;
};
const inputLimit=100000;

function ImproveDialog({connection,cwd,provider,field,value,context='',maxLength,onApply,onClose,caption}:Props&{onClose():void;caption:string}){
  const ru=useLanguage()==='ru';
  const root=useRef<HTMLElement>(null),heading=useId();
  useModal(root,true,onClose);
  const alive=useRef(true),inFlight=useRef(false);
  const [providers,setProviders]=useState<Provider[]>(),[choice,setChoice]=useState<Provider|''>('');
  const [catalogError,setCatalogError]=useState(''),[reload,setReload]=useState(0);
  const [brief,setBrief]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [result,setResult]=useState<{value:string;context:string;text:string}>();
  const limit=Math.min(maxLength??inputLimit,inputLimit);
  const selectedContext=[context.trim(),brief.trim()].filter(Boolean).join('\n\n');
  const tooLarge=value.length>inputLimit||selectedContext.length>inputLimit;
  const stale=!!result&&(result.value!==value||result.context!==selectedContext);
  const ready=!!choice&&!busy&&!tooLarge&&!!(value.trim()||selectedContext);
  const applicable=!!result&&!stale&&!busy&&!!result.text.trim()&&result.text.length<=limit;
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
  useEffect(()=>{
    let active=true;
    setCatalogError('');setProviders(undefined);setChoice('');
    request<{providers:Provider[]}>(connection,'/task-text/providers').then(response=>{
      if(!active)return;
      if(!Array.isArray(response?.providers))throw Error(ru?'Не удалось получить список провайдеров.':'Could not read the provider list.');
      const choices=response.providers.filter(id=>Object.hasOwn(providerNames,id));
      setProviders(choices);
      setChoice(provider&&choices.includes(provider)?provider:choices[0]||'');
    }).catch(e=>{if(active)setCatalogError(e instanceof Error?e.message:String(e));});
    return ()=>{active=false;};
  },[connection.url,connection.token,connection.desktop,provider,reload,ru]);

  async function generate(){
    if(!ready||inFlight.current)return;
    inFlight.current=true;setBusy(true);setError('');setResult(undefined);
    try{
      const answer=await request<{text:string}>(connection,'/task-text/improve',{
        cwd,provider:choice,field,text:value,context:selectedContext,language:ru?'ru':'en',maxLength:limit,
      });
      if(typeof answer?.text!=='string'||!answer.text.trim())throw Error(ru?'Провайдер вернул пустой ответ.':'The provider returned an empty response.');
      if(alive.current)setResult({value,context:selectedContext,text:answer.text});
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:String(e));}
    finally{inFlight.current=false;if(alive.current)setBusy(false);}
  }
  return createPortal(<div className="modal-backdrop improve-backdrop" data-improve-task-dialog=""
    onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onKeyUp={e=>e.stopPropagation()}
    onKeyDown={e=>{if(e.key==='Tab')return;e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onClose();}}}>
    <section ref={root} className="confirm-modal improve-dialog" role="dialog" aria-modal="true" aria-labelledby={heading}>
      <header><Sparkles aria-hidden="true" size={18}/><h2 id={heading}>{caption}</h2></header>
      <label>{ru?'Провайдер':'Provider'}
        <select value={choice} disabled={busy||!providers?.length} onChange={e=>{setChoice(e.target.value as Provider);setError('');setResult(undefined);}}>
          {!choice&&<option value="">{providers||catalogError?'—':(ru?'Загрузка…':'Loading…')}</option>}
          {providers?.map(id=><option key={id} value={id}>{providerNames[id]}</option>)}
        </select>
      </label>
      {(catalogError||providers?.length===0)&&<div>
        <p role="alert">{catalogError||(ru?'Нет доступных провайдеров. Проверьте подключение провайдера на ПК.':'No providers are available. Check the provider connection on the PC.')}</p>
        <button type="button" className="text-button" onClick={()=>setReload(n=>n+1)}>{ru?'Обновить список':'Refresh providers'}</button>
      </div>}
      {value&&<details className="improve-source"><summary>{ru?'Исходный текст':'Original text'}</summary><pre>{value}</pre></details>}
      {context.trim()&&<details className="improve-source"><summary>{ru?'Контекст задачи':'Task context'}</summary><pre>{context}</pre></details>}
      <label>{ru?'Пожелания к тексту':'Drafting guidance'}
        <textarea rows={2} value={brief} disabled={busy} onChange={e=>{setBrief(e.target.value);setResult(undefined);}}
          placeholder={value.trim()||context.trim()?(ru?'Что уточнить или дополнить?':'What should be clarified or added?'):(ru?'Опишите задачу или ожидаемый результат':'Describe the task or expected outcome')}/>
      </label>
      {tooLarge&&<p role="alert">{ru?'Текст поля и контекст могут содержать до 100 000 символов каждый.':'The field and context can each contain up to 100,000 characters.'}</p>}
      {error&&<p className="error-banner" role="alert">{error}</p>}
      {busy&&<p role="status">{ru?'Готовит вариант':'Drafting with'} · {choice&&providerNames[choice]}</p>}
      {result&&<>
        <label>{ru?'Предложенный текст':'Suggested text'}
          <textarea rows={6} value={result.text} onChange={e=>setResult({...result,text:e.target.value})}/>
        </label>
        {result.text.length>limit&&<p role="alert">{ru?'Сократите текст до':'Shorten the text to'} {limit} {ru?'символов.':'characters.'}</p>}
        {stale&&<p role="alert">{ru?'Исходное поле или контекст изменились. Создайте новый вариант.':'The field or its context changed. Generate a new suggestion.'}</p>}
      </>}
      <footer>
        <button type="button" className="text-button" onClick={onClose}>{ru?'Отмена':'Cancel'}</button>
        <button type="button" className={result?'secondary':'primary'} disabled={!ready} onClick={()=>void generate()}>
          {result||error?(ru?'Ещё вариант':'Generate again'):(ru?'Создать вариант':'Generate suggestion')}
        </button>
        {result&&<button type="button" className="primary" disabled={!applicable} onClick={()=>{if(applicable){onApply(result.text);onClose();}}}>{ru?'Применить':'Apply'}</button>}
      </footer>
    </section>
  </div>,document.body);
}

export function ImproveTaskText(props:Props){
  const ru=useLanguage()==='ru',[open,setOpen]=useState(false);
  const {field,value,cwd,connection,disabled,compact}=props;
  useEffect(()=>setOpen(false),[connection.url,connection.token,connection.desktop,cwd,field,disabled]);
  const verb=value.trim()?(ru?'Улучшить с ИИ':'Improve with AI'):(ru?'Заполнить с ИИ':'Fill with AI');
  const caption=verb+' · '+fieldLabels[field][ru?0:1];
  return <>
    <button type="button" data-improve-task-trigger="" className={'improve-trigger'+(compact?' improve-compact':'')}
      aria-label={caption} title={caption} disabled={disabled||!cwd} aria-haspopup="dialog"
      onClick={e=>{e.stopPropagation();setOpen(true);}}>
      <Sparkles size={compact?16:14} aria-hidden="true"/>{!compact&&verb}
    </button>
    {open&&!disabled&&<ImproveDialog {...props} caption={caption} onClose={()=>setOpen(false)}/>}
  </>;
}
