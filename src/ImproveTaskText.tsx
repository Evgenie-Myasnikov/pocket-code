import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronRight,KeyRound,Sparkles} from 'lucide-react';
import {ProviderMark} from './ProviderMark';
import {codexTaskTextBytes,CODEX_TASK_TEXT_BYTES} from './task-text-limit';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import './improve-task-text.css';

type Provider='claude'|'codex'|'copilot';
type ApiAccount={id:string;name:string};
const providerNames={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};
const fieldLabels={
  instructions:['Инструкции','Instructions'],context:['Контекст','Context'],title:['Название','Title'],
  description:['Описание','Description'],checklist:['Критерии приёмки','Acceptance criteria'],
};
const fieldObjects={instructions:'инструкцию',context:'контекст',title:'заголовок',description:'описание',checklist:'критерии приёмки'};
export type ImproveScope={connection:Connection;cwd:string;provider?:Provider};
type Props=ImproveScope&{
  field:keyof typeof fieldLabels;value:string;context?:string;maxLength?:number;
  onApply(text:string):void;disabled?:boolean;compact?:boolean;
};
const inputLimit=100000;

function ImproveDialog({connection,cwd,provider,field,value,context='',maxLength,onApply,onClose,caption}:Props&{onClose():void;caption:string}){
  const ru=useLanguage()==='ru';
  const root=useRef<HTMLElement>(null),radioName=useId(),limitHint=useId();
  const title=ru?(value.trim()?'Улучшить ':'Заполнить ')+fieldObjects[field]:(value.trim()?'Improve ':'Draft ')+fieldLabels[field][1].toLowerCase();
  useModal(root,true,onClose);
  const alive=useRef(true),inFlight=useRef(false);
  const [providers,setProviders]=useState<Provider[]>(),[choice,setChoice]=useState<Provider|'custom'|''>('');
  const [accounts,setAccounts]=useState<ApiAccount[]>([]),[accountId,setAccountId]=useState('');
  const [models,setModels]=useState<string[]>(),[model,setModel]=useState('');
  const [modelError,setModelError]=useState(''),[modelReload,setModelReload]=useState(0);
  const [catalogError,setCatalogError]=useState(''),[reload,setReload]=useState(0);
  const [brief,setBrief]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [result,setResult]=useState<{value:string;context:string;text:string}>();
  const limit=Math.min(maxLength??inputLimit,inputLimit);
  const selectedContext=[context.trim(),brief.trim()].filter(Boolean).join('\n\n');
  const codexRemaining=choice==='codex'?CODEX_TASK_TEXT_BYTES-codexTaskTextBytes(value,selectedContext):undefined;
  const codexOver=codexRemaining!==undefined&&codexRemaining<0;
  const tooLarge=value.length>inputLimit||selectedContext.length>inputLimit;
  const stale=!!result&&(result.value!==value||result.context!==selectedContext);
  const selectedAccount=accounts.find(account=>account.id===accountId);
  const ready=!!choice&&(choice!=='custom'||!!selectedAccount&&!!model&&models?.includes(model))&&!busy&&!tooLarge&&!codexOver&&!!(value.trim()||selectedContext);
  const applicable=!!result&&!stale&&!busy&&!!result.text.trim()&&result.text.length<=limit;
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
  useEffect(()=>{
    let active=true;
    setCatalogError('');setProviders(undefined);setAccounts([]);setChoice('');setAccountId('');
    request<{providers:Provider[];accounts?:ApiAccount[]}>(connection,'/task-text/providers').then(response=>{
      if(!active)return;
      if(!Array.isArray(response?.providers))throw Error(ru?'Не удалось получить список провайдеров.':'Could not read the provider list.');
      const choices=response.providers.filter(id=>Object.hasOwn(providerNames,id));
      setProviders(choices);
      if(Array.isArray(response.accounts))setAccounts(response.accounts.filter(account=>account&&typeof account.name==='string'&&!!account.name.trim()&&typeof account.id==='string'&&!!account.id));
      setChoice(provider&&choices.includes(provider)?provider:choices[0]||'');
    }).catch(e=>{if(active)setCatalogError(e instanceof Error?e.message:String(e));});
    return ()=>{active=false;};
  },[connection.url,connection.token,connection.desktop,provider,reload,ru]);

  // Opening Improve reads the local catalogue. Only the explicitly chosen API account is asked for models.
  useEffect(()=>{
    if(choice!=='custom'||!accountId)return;
    let active=true;
    request<string[]>(connection,'/custom-providers/'+encodeURIComponent(accountId)+'/models').then(items=>{
      if(!active)return;
      if(!Array.isArray(items))throw Error(ru?'Не удалось прочитать модели подключения.':'Could not read models for this connection.');
      const available=items.filter(id=>typeof id==='string'&&!!id.trim());
      setModels(available);setModel(available[0]||'');
    }).catch(e=>{if(active)setModelError(e instanceof Error?e.message:String(e));});
    return ()=>{active=false;};
  },[connection.url,connection.token,connection.desktop,choice,accountId,modelReload,ru]);
  function selectProvider(next:Provider|'custom',id=''){
    setChoice(next);setAccountId(id);setModels(undefined);setModel('');setModelError('');setError('');setResult(undefined);
  }

  async function generate(){
    if(!ready||inFlight.current)return;
    inFlight.current=true;setBusy(true);setError('');setResult(undefined);
    try{
      const answer=await request<{text:string}>(connection,'/task-text/improve',{
        cwd,provider:choice,...(choice==='custom'?{account:accountId,model}:{}),field,text:value,context:selectedContext,language:ru?'ru':'en',maxLength:limit,
      });
      if(typeof answer?.text!=='string'||!answer.text.trim())throw Error(ru?'Провайдер вернул пустой ответ.':'The provider returned an empty response.');
      if(alive.current)setResult({value,context:selectedContext,text:answer.text});
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:String(e));}
    finally{inFlight.current=false;if(alive.current)setBusy(false);}
  }
  return createPortal(<div className="modal-backdrop improve-backdrop" data-improve-task-dialog=""
    onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onKeyUp={e=>e.stopPropagation()}
    onKeyDown={e=>{if(e.key==='Tab')return;e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onClose();}}}>
    <section ref={root} className="confirm-modal improve-dialog" role="dialog" aria-modal="true" aria-label={caption}>
      <header><span className="improve-title-mark"><Sparkles aria-hidden="true" size={20}/></span><h2>{title}</h2></header>
      <fieldset className="improve-providers" disabled={busy}>
        <legend>{ru?'Провайдер':'Provider'}</legend>
        {!providers&&!catalogError&&<p role="status">{ru?'Загрузка…':'Loading…'}</p>}
        <div className="improve-options">{providers?.map(id=><label key={id} className="improve-provider-choice">
          <input type="radio" name={radioName} value={id} checked={choice===id}
            onChange={()=>selectProvider(id)}/>
          <ProviderMark provider={id}/><span>{providerNames[id]}</span>
          {choice===id&&<Check size={13} aria-hidden="true"/>}
        </label>)}</div>
        {!!accounts.length&&<details className="improve-api-accounts" data-selected={choice==='custom'||undefined} key={providers?.length?'with-builtins':'api-only'} open={!providers?.length||undefined}>
          <summary><KeyRound size={15} aria-hidden="true"/>
            <span>{ru?'API-подключения':'API connections'}{choice==='custom'&&selectedAccount?' · '+selectedAccount.name:''}</span>
            <ChevronRight size={14} aria-hidden="true"/>
          </summary>
          <div className="improve-api-fields">
            <label>{ru?'Подключение':'Connection'}<select value={choice==='custom'?accountId:''} disabled={busy} onChange={e=>selectProvider('custom',e.target.value)}>
              <option value="" disabled>{ru?'Выберите подключение':'Choose a connection'}</option>
              {accounts.map(account=><option key={account.id} value={account.id}>{account.name}</option>)}
            </select></label>
            {choice==='custom'&&selectedAccount&&<label>{ru?'Модель':'Model'}
              <select value={model} disabled={busy||!models?.length} onChange={e=>{setModel(e.target.value);setError('');setResult(undefined);}}>
                {!model&&<option value="">{modelError||models?'—':(ru?'Загрузка…':'Loading…')}</option>}
                {models?.map(id=><option key={id} value={id}>{id}</option>)}
              </select>
            </label>}
          </div>
          {choice==='custom'&&(modelError||models?.length===0)&&<div className="improve-model-error">
            <p role="alert">{modelError||(ru?'Подключение вернуло пустой список моделей.':'This connection returned no models.')}</p>
            <button type="button" className="text-button" onClick={()=>{setModelError('');setModels(undefined);setModelReload(n=>n+1);}}>{ru?'Обновить модели':'Refresh models'}</button>
          </div>}
        </details>}
      </fieldset>
      {(catalogError||providers?.length===0&&!accounts.length)&&<div>
        <p role="alert">{catalogError||(ru?'Нет доступных провайдеров. Проверьте подключение провайдера на ПК.':'No providers are available. Check the provider connection on the PC.')}</p>
        <button type="button" className="text-button" onClick={()=>setReload(n=>n+1)}>{ru?'Обновить список':'Refresh providers'}</button>
      </div>}
      {(value||context.trim())&&<div className="improve-sources">
        {value&&<details className="improve-source"><summary><ChevronRight size={14} aria-hidden="true"/>{ru?'Исходный текст':'Original text'}</summary><pre>{value}</pre></details>}
        {context.trim()&&<details className="improve-source"><summary><ChevronRight size={14} aria-hidden="true"/>{ru?'Контекст задачи':'Task context'}</summary><pre>{context}</pre></details>}
      </div>}
      <label>{ru?'Пожелания к тексту':'Drafting guidance'}
        <textarea rows={2} value={brief} disabled={busy} aria-describedby={codexRemaining!==undefined?limitHint:undefined} onChange={e=>{setBrief(e.target.value);setResult(undefined);}}
          placeholder={value.trim()||context.trim()?(ru?'Что уточнить или дополнить?':'What should be clarified or added?'):(ru?'Опишите задачу или ожидаемый результат':'Describe the task or expected outcome')}/>
      </label>
      {codexRemaining!==undefined&&<p id={limitHint} className={codexOver?'improve-byte-limit over-limit':'improve-byte-limit'}>
        {codexOver
          ?(ru?`Лимит Codex — ${CODEX_TASK_TEXT_BYTES} байт UTF-8. Превышение — ${new Intl.NumberFormat('ru',{style:'unit',unit:'byte',unitDisplay:'long'}).format(-codexRemaining)}. Сократите текст, контекст или пожелания.`:`Codex input exceeds the ${CODEX_TASK_TEXT_BYTES} UTF-8 byte limit by ${-codexRemaining} ${codexRemaining===-1?'byte':'bytes'}. Shorten the field, context or guidance.`)
          :(ru?`Codex · Осталось ${codexRemaining} из ${CODEX_TASK_TEXT_BYTES} байт UTF-8.`:`Codex · ${codexRemaining} of ${CODEX_TASK_TEXT_BYTES} UTF-8 bytes remaining.`)}
        {codexOver&&(accounts.length>0||providers?.some(p=>p!=='codex'))&&(ru?' Можно выбрать другого провайдера.':' You can also choose another provider.')}
      </p>}
      {tooLarge&&<p role="alert">{ru?'Текст поля и контекст могут содержать до 100 000 символов каждый.':'The field and context can each contain up to 100,000 characters.'}</p>}
      {error&&<p className="error-banner" role="alert">{error}</p>}
      {busy&&<p role="status">{ru?'Готовит вариант':'Drafting with'} · {choice==='custom'?selectedAccount?.name:choice&&providerNames[choice]}</p>}
      {result&&<>
        <label className="improve-suggestion">{ru?'Предложенный текст':'Suggested text'}
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
