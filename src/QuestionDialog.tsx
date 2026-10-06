import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {MessageCircle,X} from 'lucide-react';
import type {Approval} from '../server/types';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import './question-dialog.css';

type Question={id?:string;question:string;header?:string;multiSelect?:boolean;allowFreeform?:boolean;options?:{label:string;description?:string}[]};
export function QuestionDialog({approval,provider,decide,autoOpen=true}:{approval:Approval;provider:string;autoOpen?:boolean;decide:(allow:boolean,answers?:Record<string,string>)=>Promise<void>}){
 const ru=useLanguage()==='ru',l=(en:string,ruText:string)=>ru?ruText:en;
 const questions=(approval.input.questions as Question[]).filter(q=>q&&typeof q.question==='string');
 const [open,setOpen]=useState(autoOpen),[selected,setSelected]=useState<Record<number,string[]>>({}),[custom,setCustom]=useState<Record<number,string>>({});
 const [busy,setBusy]=useState(false),[resolved,setResolved]=useState(false),[error,setError]=useState(''),[expired,setExpired]=useState(Date.now()>=approval.expiresAt);
 const sending=useRef(false),dialog=useRef<HTMLDivElement>(null),title=useId();
 useModal(dialog,open&&!resolved,()=>setOpen(false));
 useEffect(()=>{const timer=setTimeout(()=>setExpired(true),Math.max(0,approval.expiresAt-Date.now()));return()=>clearTimeout(timer);},[approval.expiresAt]);
 const answer=(index:number)=>[...(selected[index]||[]),...(custom[index]?.trim()?[custom[index].trim()]:[])].join(', ');
 const complete=questions.length>0&&questions.every((_,i)=>answer(i));
 async function submit(allow:boolean){
  if(sending.current||expired||allow&&!complete)return;
  sending.current=true;setBusy(true);setError('');
  try{await decide(allow,allow?Object.fromEntries(questions.map((q,i)=>[q.id||q.question,answer(i)])):undefined);setResolved(true);setOpen(false);}
  catch(e){setError(e instanceof Error?e.message:l('Could not send the answer. Try again.','Не удалось отправить ответ. Повторите попытку.'));}
  finally{sending.current=false;setBusy(false);}
 }
 if(resolved)return null;
 return <><section className="question-request"><MessageCircle size={18}/><div><strong>{l('Waiting for your response','Ждёт вашего ответа')}</strong><p>{questions[0]?.question}</p><button type="button" onClick={()=>setOpen(true)}>{l('Answer questions','Ответить на вопросы')}{questions.length>1?` · ${questions.length}`:''}</button></div></section>
 {open&&createPortal(<div className="question-overlay" onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}><div ref={dialog} className="question-dialog" role="dialog" aria-modal="true" aria-labelledby={title}>
  <header><div><small>{provider}</small><h2 id={title}>{l('Questions for you','Вопросы к вам')}</h2></div><button type="button" className="icon-button" aria-label={l('Close questions','Закрыть вопросы')} onClick={()=>setOpen(false)}><X size={20}/></button></header>
  <form onSubmit={e=>{e.preventDefault();void submit(true);}}>
   <div className="question-body">{questions.map((q,index)=><fieldset key={q.id||index} disabled={busy||expired}>
    <legend>{q.header&&<small>{q.header} · </small>}{q.question}</legend>
    {q.multiSelect&&<p className="muted">{l('Choose one or more options','Можно выбрать несколько вариантов')}</p>}
    <div className="question-options">{q.options?.map((option,i)=><label key={i} className={(selected[index]||[]).includes(option.label)?'selected':''}>
     <input type={q.multiSelect?'checkbox':'radio'} name={`${title}-${index}`} checked={(selected[index]||[]).includes(option.label)} onChange={()=>{setSelected(previous=>({...previous,[index]:q.multiSelect?(previous[index]||[]).includes(option.label)?(previous[index]||[]).filter(v=>v!==option.label):[...(previous[index]||[]),option.label]:[option.label]}));if(!q.multiSelect)setCustom(previous=>({...previous,[index]:''}));}}/>
     <span><strong>{option.label}</strong>{option.description&&<small>{option.description}</small>}</span>
    </label>)}</div>
    {q.allowFreeform!==false&&<label className="question-custom">{l('Your answer','Свой ответ')}<textarea rows={2} maxLength={10000} value={custom[index]||''} onChange={e=>{setCustom(previous=>({...previous,[index]:e.target.value}));if(!q.multiSelect)setSelected(previous=>({...previous,[index]:[]}));}}/></label>}
   </fieldset>)}
   {expired&&<p role="status">{l('This request has expired. Wait for a new question from the agent.','Время ожидания истекло. Дождитесь нового вопроса от агента.')}</p>}
   {error&&<p role="alert" className="error">{error}</p>}</div>
   <footer><button type="button" className="secondary" disabled={busy||expired} onClick={()=>void submit(false)}>{l('Decline','Отклонить')}</button><button type="submit" className="primary" disabled={busy||expired||!complete}>{busy?l('Sending…','Отправляем…'):l('Send answers','Отправить ответы')}</button></footer>
  </form>
 </div></div>,document.body)}</>;
}
