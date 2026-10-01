import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ExternalLink,GitPullRequest,Play,RefreshCw} from 'lucide-react';
import {providerRequest,type Connection} from './api';
import {t} from './i18n';
import {useBackAction} from './navigation';
import {jiraRoleLabel,type JiraRole} from './jira-preferences';
import {JiraDescription} from './JiraDescription';
import type {JiraIssue,JiraTransition,JiraTransitionField} from '../server/jira';
import type {JobView} from '../server/types';
import type {CodexAccess} from './preferences';
import {isTimeTracking,validEstimate} from './jira-time';

export type JiraLink={provider:'claude'|'codex';cwd:string;jobId?:string;sessionId?:string;pr?:{url:string;number:number}};
type Action={id:string;label:string;kind:'start'|'transition'|'pr';transitions:JiraTransition[]};
type WorkflowView={issue:JiraIssue;stage:string;role:JiraRole;actions:Action[];link?:JiraLink;pending?:{id:string;action:string;phase:string;provider:'claude'|'codex';message:string}};
type PullRequestPreview={ready:boolean;reason?:string;base:string;head:string;headSha:string;files:unknown[];commits:number|unknown[];existing?:{url:string;number:number}};
type Props={connection:Connection;site:string;issue:JiraIssue;provider:'claude'|'codex';codexAccess?:CodexAccess;role:JiraRole;roots:string[];budget:number;jobs:JobView[];onBack():void;onOpen(job:JobView):void;onOpenLinked?(link:JiraLink):void;onChanged(issue:JiraIssue):void};
const supported=(field:JiraTransitionField)=>isTimeTracking(field)||Boolean(field.allowedValues?.length)||['string','number','date','datetime'].includes(field.schema.type);
const optionLabel=(value:any)=>typeof value==='object'&&value?String(value.name||value.label||value.displayName||value.value||value.id||value.accountId):String(value);
function optionValue(value:any,field:JiraTransitionField){
  if(typeof value!=='object'||!value)return value;
  if(field.schema.type==='user'||field.schema.items==='user')return{accountId:value.accountId||value.id};
  if(value.id!==undefined)return{id:String(value.id)};
  if(value.value!==undefined)return{value:value.value};
  return value;
}
function fieldValue(raw:string,field:JiraTransitionField){
  if(isTimeTracking(field))return {originalEstimate:raw.trim()};
  if(field.allowedValues?.length){
    const indices=field.schema.type==='array'?raw.split(',').filter(Boolean):[raw];
    const values=indices.map(index=>optionValue(field.allowedValues![Number(index)],field));
    return field.schema.type==='array'?values:values[0];
  }
  if(field.schema.type==='number'||field.schema.type==='integer')return Number(raw);
  if(field.schema.type==='boolean')return raw==='true';
  if(field.schema.type==='array')return raw.split('\n').map(value=>value.trim()).filter(Boolean);
  if(field.schema.type==='datetime')return new Date(raw).toISOString();
  return raw;
}
function requiredInvalid(field:JiraTransitionField,value:string|undefined){
  if(!value?.trim())return field.required&&!field.hasDefaultValue;
  if(isTimeTracking(field))return !validEstimate(value);
  if(field.schema.type==='number'||field.schema.type==='integer')return !Number.isFinite(Number(value))||field.schema.type==='integer'&&!Number.isInteger(Number(value));
  return false;
}
function RequiredFields({transition,values,onChange}:{transition?:JiraTransition;values:Record<string,string>;onChange(id:string,value:string):void}){
  if(!transition)return null;
  return <>{Object.entries(transition.fields).filter(([id,field])=>isTimeTracking(field)||field.required&&!field.hasDefaultValue||values[id]).map(([id,field])=>{
    if(!supported(field))return null;
    const value=values[id]||'',label=`${field.name}${field.required?' *':''}`;
    if(isTimeTracking(field))return <label key={id}>{t('Оценка времени')}{field.required?' *':''}<input aria-label={t('Оценка времени')} value={value} placeholder="2h / 1d 30m" onChange={event=>onChange(id,event.target.value)}/><small>{t('Укажите плановую оценку для перехода: w — недели, d — дни, h — часы, m — минуты. Это не списание времени.')}</small>{value&&!validEstimate(value)&&<small role="alert">{t('Введите оценку времени, например 2h или 1d 30m.')}</small>}</label>;
    return <label key={id}>{label}{field.allowedValues?.length?<select aria-label={label} multiple={field.schema.type==='array'} value={field.schema.type==='array'?value.split(',').filter(Boolean):value} onChange={event=>onChange(id,field.schema.type==='array'?[...event.target.selectedOptions].map(option=>option.value).join(','):event.target.value)}>{field.schema.type!=='array'&&<option value="">{t('Выберите значение')}</option>}{field.allowedValues.map((option,index)=><option key={index} value={String(index)}>{optionLabel(option)}</option>)}</select>:field.schema.type==='boolean'?<select aria-label={label} value={value} onChange={event=>onChange(id,event.target.value)}><option value="">{t('Выберите значение')}</option><option value="true">{t('Да')}</option><option value="false">{t('Нет')}</option></select>:field.schema.type==='array'?<textarea aria-label={label} value={value} onChange={event=>onChange(id,event.target.value)} placeholder={t('По одному значению на строку')}/>:<input aria-label={label} type={field.schema.type==='date'?'date':field.schema.type==='datetime'?'datetime-local':field.schema.type==='number'||field.schema.type==='integer'?'number':'text'} step={field.schema.type==='integer'?1:'any'} value={value} onChange={event=>onChange(id,event.target.value)}/>}</label>;
  })}</>;
}
const describeItem=(item:any)=>typeof item==='string'?item:String(item?.path||item?.subject||item?.message||item?.name||'');

export function JiraWorkflow({connection,site,issue,provider,codexAccess='full',role,roots,budget,jobs,onBack,onOpen,onOpenLinked,onChanged}:Props){
  const request=providerRequest(provider);
  const [view,setView]=useState<WorkflowView|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [fullIssue,setFullIssue]=useState<JiraIssue|null>(null),[descriptionLoading,setDescriptionLoading]=useState(true),[descriptionError,setDescriptionError]=useState('');
  const [action,setAction]=useState<Action|null>(null),[transitionId,setTransitionId]=useState(''),[fields,setFields]=useState<Record<string,string>>({});
  const [cwd,setCwd]=useState(roots[0]||''),[mode,setMode]=useState<'default'|'plan'>('default'),[busy,setBusy]=useState(false);
  const [preview,setPreview]=useState<PullRequestPreview|null>(null),[previewBusy,setPreviewBusy]=useState(false),[title,setTitle]=useState(`${issue.key}: ${issue.summary}`),[body,setBody]=useState(`Jira: ${issue.url}\n\n${issue.summary}`);
  const [recovering,setRecovering]=useState(false);
  const [previewRevision,setPreviewRevision]=useState(0);
  const generation=useRef(0),attempt=useRef<{signature:string;id:string}|null>(null);
  useBackAction(()=>{if(busy)return true;if(recovering){setRecovering(false);return true;}if(action){setAction(null);return true;}onBack();return true;},20);
  async function loadDescription(epoch=generation.current){
    setDescriptionLoading(true);setDescriptionError('');
    try{const next=await request<JiraIssue>(connection,`/jira/issue?site=${encodeURIComponent(site)}&key=${encodeURIComponent(issue.key)}`);if(epoch!==generation.current)return;setFullIssue(next);onChanged(next);}
    catch(e){if(epoch===generation.current)setDescriptionError((e as Error).message);}finally{if(epoch===generation.current)setDescriptionLoading(false);}
  }
  async function refresh(){
    const epoch=++generation.current;setLoading(true);setError('');setFields({});
    void loadDescription(epoch);
    try{
      const next=await request<WorkflowView>(connection,`/jira/workflow?site=${encodeURIComponent(site)}&key=${encodeURIComponent(issue.key)}&provider=${provider}&role=${role}`);
      if(epoch!==generation.current)return;
      const nextAction=next.actions.find(item=>item.id===action?.id);
      setView(next);setAction(old=>old?next.actions.find(item=>item.id===old.id)||null:null);
      setTransitionId(old=>nextAction?.transitions.some(item=>item.id===old)?old:nextAction?.transitions[0]?.id||'');setPreviewRevision(value=>value+1);
      if(next.link?.cwd&&roots.includes(next.link.cwd))setCwd(next.link.cwd);onChanged(next.issue);
    }
    catch(e){if(epoch===generation.current)setError((e as Error).message);}finally{if(epoch===generation.current)setLoading(false);}
  }
  useEffect(()=>{setAction(null);setFields({});setPreview(null);void refresh();return()=>{generation.current++;};},[connection,site,issue.key,provider,role]);
  useEffect(()=>{
    if(action?.kind!=='pr'||!cwd)return;
    let cancelled=false;setPreview(null);setPreviewBusy(true);setError('');
    request<PullRequestPreview>(connection,`/jira/workflow/pr?cwd=${encodeURIComponent(cwd)}&key=${encodeURIComponent(issue.key)}`).then(value=>{if(!cancelled)setPreview(value);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setPreviewBusy(false);});
    return()=>{cancelled=true;};
  },[action?.id,cwd,connection,issue.key,previewRevision]);
  const transition=action?.transitions.find(item=>item.id===transitionId);
  const unsupported=Object.entries(transition?.fields||{}).filter(([,field])=>field.required&&!field.hasDefaultValue&&!supported(field));
  const invalid=unsupported.length>0||Object.entries(transition?.fields||{}).some(([id,field])=>requiredInvalid(field,fields[id]));
  const linkedJob=jobs.find(job=>job.id===view?.link?.jobId);
  function choose(next:Action){setAction(next);setTransitionId(next.transitions[0]?.id||'');setFields({});setPreview(null);setError('');}
  async function recover(){
    if(!view?.pending||busy)return;const pending=view.pending,epoch=generation.current;setBusy(true);setError('');
    try{const result=await request<{view:WorkflowView}>(connection,'/jira/workflow/recover',{site,key:issue.key,provider:pending.provider,role,id:pending.id,confirmed:true});if(epoch!==generation.current)return;attempt.current=null;setAction(null);setFields({});setView(result.view);onChanged(result.view.issue);setRecovering(false);}
    catch(e){if(epoch===generation.current)setError((e as Error).message);}finally{if(epoch===generation.current)setBusy(false);}
  }
  async function submit(){
    if(!action||busy||loading||invalid||action.kind==='start'&&!cwd||action.kind==='pr'&&(!preview?.ready||!title.trim()))return;
    const payload={site,key:issue.key,provider,role,action:action.id,cwd,mode:role==='developer'?mode:'plan',maxBudgetUsd:budget,...(provider==='codex'?{codexAccess}:{}),...(transitionId?{transitionId}:{}),fields:Object.fromEntries(Object.entries(fields).filter(([id,value])=>value!==''&&transition?.fields[id]).map(([id,value])=>[id,fieldValue(value,transition!.fields[id])])),...(action.kind==='pr'&&preview?{pullRequest:{title:title.trim(),body,base:preview.base,head:preview.head,headSha:preview.headSha}}:{})};
    const signature=JSON.stringify(payload);if(attempt.current?.signature!==signature)attempt.current={signature,id:crypto.randomUUID()};
    const epoch=generation.current;setBusy(true);setError('');
    try{const result=await request<{job?:JobView;view:WorkflowView}>(connection,'/jira/workflow/action',{...payload,id:attempt.current.id});if(epoch!==generation.current)return;attempt.current=null;setView(result.view);onChanged(result.view.issue);setAction(null);if(result.job)onOpen(result.job);}
    catch(e){if(epoch===generation.current)setError((e as Error).message);}finally{if(epoch===generation.current)setBusy(false);}
  }
  return <section className="jira-detail" aria-label={t('Подробности задачи')}>
    <div className="jira-detail-nav"><button className="text-button" disabled={busy} onClick={()=>action?setAction(null):onBack()}><ArrowLeft size={18}/>{action?t('К задаче'):t('К списку задач')}</button><button className="icon-button" aria-label={t('Обновить задачу')} disabled={busy||loading} onClick={()=>void refresh()}><RefreshCw size={18}/></button></div>
    <p className="eyebrow">{issue.key} · {t(jiraRoleLabel(role))}</p><h2>{view?.issue.summary||issue.summary}</h2>
    <div className="jira-detail-meta"><span>{view?.issue.status||issue.status}</span><span>{view?.issue.issueType||issue.issueType}</span><span>{view?.issue.priority||issue.priority}</span></div>
    {error&&<p className="error" role="alert">{t(error)}</p>}{loading&&<p role="status">{t('Загружаем доступные действия…')}</p>}
    {view?.pending&&<section className="jira-interrupted" aria-label={t('Прерванное действие')}><h3>{t('Прерванное действие')}</h3><p>{t(view.pending.message)}</p>{recovering?<><p>{t('Это не отменяет изменения в Jira или PR. Проверьте существующий чат и результат в Jira перед повторной попыткой.')}</p><div className="jira-form-actions"><button className="text-button" disabled={busy} onClick={()=>setRecovering(false)}>{t('Отмена')}</button><button className="secondary" disabled={busy} onClick={()=>void recover()}>{t('Проверено — снять блокировку')}</button></div></>:<button className="secondary" disabled={busy} onClick={()=>setRecovering(true)}>{t('Снять блокировку действия')}</button>}</section>}
    {!action?<>
      <div className="jira-description">{descriptionLoading&&!fullIssue?<p className="muted" role="status">{t('Загружаем описание…')}</p>:fullIssue?fullIssue.description?<JiraDescription text={fullIssue.description} format={fullIssue.descriptionFormat} url={fullIssue.url}/>:<p>{t('Без описания')}</p>:null}{descriptionError&&<div className="error" role="alert"><p>{t('Не удалось загрузить описание.')}{' '}{t(descriptionError)}</p><button className="secondary" disabled={descriptionLoading} onClick={()=>void loadDescription()}>{t('Повторить загрузку описания')}</button></div>}</div>
      <div className="jira-detail-links"><a href={issue.url} target="_blank" rel="noreferrer">{t('Открыть в Jira')}<ExternalLink size={14}/></a>{view?.link?.pr&&<a href={view.link.pr.url} target="_blank" rel="noreferrer">PR #{view.link.pr.number}<ExternalLink size={14}/></a>}{(linkedJob||view?.link?.sessionId&&onOpenLinked)&&<button className="secondary" onClick={()=>linkedJob?onOpen(linkedJob):onOpenLinked?.(view!.link!)}>{t('Открыть чат')}</button>}</div>
      {view&&!loading&&!view.pending&&<section className="jira-next-action"><h3>{t('Следующий шаг')}</h3>{view.actions.length?<div className="jira-action-list">{view.actions.map(item=><button key={item.id} className={item.kind==='start'?'primary':'secondary'} onClick={()=>choose(item)}>{item.kind==='start'?<Play size={16}/>:item.kind==='pr'?<GitPullRequest size={16}/>:null}{t(item.label)}</button>)}</div>:<p className="muted">{t('Для вашей роли сейчас нет доступных действий. Проверьте статус в Jira или выберите другую роль в настройках.')}</p>}</section>}
    </>:<section className="jira-action-form"><h3>{t(action.label)}</h3>
      {(action.kind==='start'||action.kind==='pr')&&<label>{t('Папка проекта для {0}',provider==='codex'?'Codex':'Claude')}<select aria-label={t('Папка проекта для {0}',provider==='codex'?'Codex':'Claude')} value={cwd} disabled={busy} onChange={event=>setCwd(event.target.value)}>{roots.map(root=><option key={root}>{root}</option>)}</select></label>}
      {action.kind==='start'&&<>{role==='developer'?<label>{t('Действие')}<select value={mode} disabled={busy} onChange={event=>setMode(event.target.value as 'default'|'plan')}><option value="default">{t('Выполнить задачу')}</option><option value="plan">{t('Сначала составить план')}</option></select></label>:<p className="muted">{t('Ревью и QA выполняются в режиме чтения. Агент анализирует проект без изменения файлов.')}</p>}<p className="muted">{t('Агент выполнит работу в чате. Проверку и смену следующего статуса вы подтверждаете отдельно.')}</p></>}
      {action.transitions.length>1?<label>{t('Новый статус')}<select aria-label={t('Новый статус')} value={transitionId} disabled={busy} onChange={event=>{setTransitionId(event.target.value);setFields({});}}>{action.transitions.map(item=><option key={item.id} value={item.id}>{item.to.name}</option>)}</select></label>:transition&&<p className="muted">{t('Новый статус')}: <strong>{transition.to.name}</strong></p>}
      <RequiredFields transition={transition} values={fields} onChange={(id,value)=>setFields(old=>({...old,[id]:value}))}/>
      {unsupported.length>0&&<p className="error" role="alert">{t('Этот переход требует поля, которые нужно заполнить в Jira: {0}.',unsupported.map(([,field])=>field.name).join(', '))} <a href={issue.url} target="_blank" rel="noreferrer">{t('Открыть в Jira')}</a></p>}
      {action.kind==='pr'&&<div className="jira-pr-preview">{previewBusy?<p role="status">{t('Проверяем изменения для PR…')}</p>:preview&&<><p><strong>{preview.head}</strong> → <strong>{preview.base}</strong></p>{preview.existing&&<p><a href={preview.existing.url} target="_blank" rel="noreferrer">PR #{preview.existing.number}<ExternalLink size={14}/></a></p>}{!preview.ready&&<p className="error">{t(preview.reason||'PR пока нельзя создать.')}</p>}<details><summary>{t('Изменённые файлы')} ({preview.files?.length||0})</summary><ul>{(preview.files||[]).map((file,index)=><li key={index}>{describeItem(file)}</li>)}</ul></details><p>{t('Коммиты')}: {Array.isArray(preview.commits)?preview.commits.length:preview.commits}</p><label>{t('Название PR')}<input value={title} onChange={event=>setTitle(event.target.value)} disabled={busy}/></label><label>{t('Описание PR')}<textarea value={body} onChange={event=>setBody(event.target.value)} disabled={busy}/></label><p className="muted">{t('PR и статус изменятся только после вашего подтверждения ниже.')}</p></>}</div>}
      <div className="jira-form-actions"><button className="text-button" disabled={busy} onClick={()=>setAction(null)}>{t('Отмена')}</button><button className="primary" disabled={busy||loading||invalid||action.kind==='start'&&!cwd||action.kind==='pr'&&(!preview?.ready||!title.trim()||previewBusy)} onClick={()=>void submit()}>{busy?t('Подождите…'):action.kind==='pr'?t(preview?.existing?'Отправить на ревью':'Создать PR и отправить на ревью'):t(action.label)}</button></div>
    </section>}
  </section>;
}
