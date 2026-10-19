import {useEffect,useState,type ReactNode} from 'react';
import {Check,ShieldCheck,X,Terminal,FilePlus2,Pencil,Globe,ListChecks,Wrench} from 'lucide-react';
import type {Approval} from '../server/types';
import {t,useLanguage} from './i18n';
import {DiffBody,ToolFields,Markdown} from './RichBlocks';
import {QuestionDialog} from './QuestionDialog';
import {elapsed} from './RunningAction';
import {plural} from './plural';
import './approval-card.css';

/** How the person decided. message goes to the agent with a denial; remember applies the provider's own "allow such" rules; mode sets how an approved plan runs. */
export type ApprovalExtra={message?:string;remember?:boolean;mode?:'default'|'acceptEdits'};
export type Decide=(allow:boolean,answers?:Record<string,string>,extra?:ApprovalExtra)=>Promise<void>;
type Provider='claude'|'codex'|'copilot';
const str=(value:unknown)=>typeof value==='string'?value:Array.isArray(value)?value.filter(item=>typeof item==='string').join(' '):'';
const base=(value:string)=>value.replace(/[\\/]+$/,'').split(/[\\/]/).pop()||value;
const lines=(value:string)=>value?value.replace(/\r\n/g,'\n').replace(/\n$/,'').split('\n').length:0;

/** Turns a provider rule into words: "Bash(npm test:*)", "file edits". */
function ruleText(suggestion:unknown){
  const value=suggestion as {type?:string;rules?:{toolName?:string;ruleContent?:string}[];mode?:string;directories?:string[]};
  if(value?.type==='addRules'||value?.type==='replaceRules')return (value.rules||[]).map(rule=>rule.ruleContent?`${rule.toolName}(${rule.ruleContent})`:rule.toolName||'').filter(Boolean).join(', ');
  if(value?.type==='setMode'&&value.mode==='acceptEdits')return t('правки файлов');
  if(value?.type==='addDirectories')return (value.directories||[]).map(base).join(', ');
  return '';
}
function rememberLabel(suggestions:unknown[]){
  const destination=(suggestions[0] as {destination?:string})?.destination;
  return destination==='session'?t('Разрешать такие в этом чате'):destination==='userSettings'?t('Разрешать такие везде'):t('Разрешать такие в этом проекте');
}
/** One readable view per tool: what will run or change, never raw JSON first. */
function describe(approval:Approval):{Icon:typeof Terminal;title:string;body:ReactNode}{
  const input=approval.input||{},tool=approval.tool,name=tool.toLowerCase();
  const path=str(input.file_path)||str(input.notebook_path)||str(input.path);
  if(tool==='Bash'||tool==='Codex command'||name==='powershell'){
    const command=str(input.command),note=str(input.description)||str(input.reason);
    return {Icon:Terminal,title:t('Выполнить команду?'),body:<>{note&&<p className="approval-note">{note}</p>}<pre className="tool-command approval-command">{command}</pre>{str(input.cwd)&&<p className="approval-meta">{t('Папка')}: <code>{str(input.cwd)}</code></p>}</>};
  }
  if(tool==='Write'){
    const content=str(input.content);
    return {Icon:FilePlus2,title:t('Создать файл {0}?',base(path)),body:<><p className="approval-meta"><code>{path}</code> · {plural(lines(content),['{0} строка','{0} строки','{0} строк'])}</p><details className="approval-content"><summary>{t('Показать содержимое')}</summary><DiffBody input={input} name="write"/></details></>};
  }
  if(tool==='Edit'||tool==='MultiEdit'||tool==='NotebookEdit'||tool==='Codex file changes'){
    const changes=Array.isArray(input.changes)?input.changes as {path?:string}[]:[];
    const title=changes.length?t('Применить изменения: {0}?',plural(changes.length,['{0} файл','{0} файла','{0} файлов'])):t('Изменить файл {0}?',base(path));
    return {Icon:Pencil,title,body:<>{path&&<p className="approval-meta"><code>{path}</code></p>}{str(input.reason)&&<p className="approval-note">{str(input.reason)}</p>}<DiffBody input={input} name={name}/></>};
  }
  if(tool==='WebFetch'||tool==='WebSearch'){
    const target=str(input.url)||str(input.query);
    return {Icon:Globe,title:tool==='WebFetch'?t('Открыть страницу?'):t('Искать в интернете?'),body:<>{target&&<pre className="tool-command approval-command">{target}</pre>}{str(input.prompt)&&<p className="approval-note">{str(input.prompt)}</p>}</>};
  }
  return {Icon:Wrench,title:t('Разрешить {0}?',tool),body:<ToolFields input={input}/>};
}
/** Counts down only when a timeout was chosen in settings; otherwise the request waits. */
function Expiry({expiresAt}:{expiresAt:number}){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{if(!expiresAt)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[expiresAt]);
  if(!expiresAt)return <p className="approval-expiry">{t('Разрешение только на это действие · ждёт вашего решения')}</p>;
  const left=expiresAt-now;
  return <p className="approval-expiry" data-urgent={left<120000||undefined}>{left>0?t('Отказ через {0}, если не ответить',elapsed(left)):t('Время ожидания истекло')}</p>;
}
export function ApprovalCard({approval,decide,provider='claude',autoOpenQuestions=true}:{approval:Approval;provider?:Provider;autoOpenQuestions?:boolean;decide:Decide}){
  useLanguage();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[denying,setDenying]=useState(false),[comment,setComment]=useState('');
  const questions=approval.tool==='AskUserQuestion'&&Array.isArray(approval.input.questions)?approval.input.questions:[];
  async function submit(allow:boolean,extra?:ApprovalExtra){setBusy(true);setError('');try{await decide(allow,undefined,extra);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  if(questions.length)return <QuestionDialog approval={approval} provider={provider==='copilot'?'Copilot':provider==='codex'?'Codex':'Claude'} decide={decide} autoOpen={autoOpenQuestions}/>;
  // Only Claude passes a denial comment to the model; other providers receive a plain refusal.
  const commentable=provider==='claude',plan=approval.tool==='ExitPlanMode';
  const suggestions=Array.isArray(approval.suggestions)?approval.suggestions:[],rules=suggestions.map(ruleText).filter(Boolean).join(', ');
  const deny=()=>{if(commentable&&!denying){setDenying(true);return;}void submit(false,comment.trim()?{message:comment.trim()}:undefined);};
  const view=plan?{Icon:ListChecks,title:t('Утвердить план?'),body:<div className="approval-plan"><Markdown text={str(approval.input.plan)}/></div>}:describe(approval);
  return <section className="approval-card" data-tool={approval.tool} aria-label={view.title}>
    <div className="eyebrow"><ShieldCheck size={16} aria-hidden="true"/>{t('Нужно ваше решение')}</div>
    <h3><view.Icon size={20} aria-hidden="true"/>{view.title}</h3>
    {view.body}
    {!plan&&<details className="approval-raw"><summary>{t('Подробности')}</summary><pre>{JSON.stringify(approval.input,null,2)}</pre></details>}
    <Expiry expiresAt={approval.expiresAt}/>
    {error&&<div className="error-banner" role="alert">{t(error)}</div>}
    {denying&&<label className="approval-comment">{plan?t('Что изменить в плане? (необязательно)'):t('Что сделать вместо этого? (необязательно)')}<textarea rows={2} maxLength={4000} autoFocus value={comment} disabled={busy} onChange={event=>setComment(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();deny();}if(event.key==='Escape'){event.stopPropagation();setDenying(false);}}}/></label>}
    <div className="approval-actions">
      {plan?<>
        <button className="secondary" disabled={busy} onClick={deny}>{denying?t('Отправить замечания'):t('Доработать план')}</button>
        {!denying&&<button className="secondary" disabled={busy} onClick={()=>void submit(true,{mode:'default'})}>{t('Выполнять, спрашивать правки')}</button>}
        {!denying&&<button className="primary" disabled={busy} onClick={()=>void submit(true,{mode:'acceptEdits'})}><Check size={16} aria-hidden="true"/>{t('Выполнять, правки автоматически')}</button>}
      </>:<>
        <button className="secondary" disabled={busy} onClick={deny}><X size={16} aria-hidden="true"/>{denying?t('Отклонить'):commentable?t('Отклонить…'):t('Отклонить')}</button>
        {denying&&<button className="text-button" disabled={busy} onClick={()=>{setDenying(false);setComment('');}}>{t('Отмена')}</button>}
        {!denying&&suggestions.length>0&&<button className="secondary approval-remember" disabled={busy} title={rules||undefined} onClick={()=>void submit(true,{remember:true})}>{rememberLabel(suggestions)}{rules&&<small>{rules}</small>}</button>}
        {!denying&&<button className="primary" disabled={busy} onClick={()=>void submit(true)}><Check size={16} aria-hidden="true"/>{t('Разрешить')}</button>}
      </>}
    </div>
  </section>;
}
