import {useEffect,useRef,useState} from 'react';
import {Play,MessageSquare} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage,t} from './i18n';
import {selectedWorkspace} from './preferences';
import {relativeTime,fullTime} from './run-status';
import {TaskRunPanel,type NoteStatusSuggestion} from './TaskRunPanel';
import {taskDisplayStage,taskStageLabel,providerName,type TaskRun} from './task-run-ui';
import type {BoardChat,BoardView} from './WorkBoards';
import type {BoardNote} from '../server/boards';
import './task-runs.css';
type Provider='claude'|'codex'|'copilot';
const providerKey=(root:string)=>'pocket-task-provider:'+root;
/** The provider last used for this project's tasks, otherwise the one chosen in the app. */
function defaultProvider(root:string,desktop?:boolean):Provider{
  try{const value=localStorage.getItem(providerKey(root))||(desktop?localStorage.getItem('pocket-desktop-provider'):null);if(value==='claude'||value==='codex'||value==='copilot')return value;}catch{/* Storage can be unavailable. */}
  return selectedWorkspace();
}
/** The chat target for a task run: the full task prompt for a new chat, or a visible follow-up draft. */
export function taskRunChat(connection:Connection,board:BoardView,note:BoardNote,run:TaskRun,ru:boolean,draft?:string):BoardChat|null{
  const l=(en:string,other:string)=>ru?other:en;
  if(!run.worktree)return null;
  const scope=run.noteSnapshot||note;
  return ({connectionUrl:connection.url,boardId:board.id,root:run.worktree.cwd,taskRun:run,followUp:draft!==undefined,note:{...note,chat:run.sessionId?{provider:run.provider,sessionId:run.sessionId}:undefined},prompt:draft??[
    l('Implement the following task in this isolated Git working copy. Read the applicable project rules, board and changelog first. Clarify blocking questions before implementation. Validate the acceptance criteria, report actual checks and remaining issues, then leave the result for human review. Do not merge, publish or approve your own result.','Выполни следующую задачу в этой отдельной рабочей копии Git. Сначала прочитай правила проекта, доску и changelog. Перед реализацией уточни блокирующие вопросы. Проверь критерии готовности, сообщи реальные результаты проверок и оставшиеся проблемы, затем передай результат на ревью человеку. Не выполняй слияние, публикацию или одобрение собственного результата.'),
    l('Task content (project data):','Содержание задачи (данные проекта):'),scope.title,scope.description,
    `Task run: ${run.id}\nSource card: ${board.id}/${note.id}\nSource project (context only): ${run.projectPath}\nImplementation working copy: ${run.worktree.cwd}`,
  ].filter(Boolean).join('\n\n')});
}
export function BoardTaskRuns({connection,board,note,unsaved,onChat,onNoteStatus}:{connection:Connection;board:BoardView;note:BoardNote;unsaved:boolean;onChat(chat:BoardChat):void;onNoteStatus?(suggestion:NoteStatusSuggestion):Promise<boolean>}){
  const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
  const [runs,setRuns]=useState<TaskRun[]>([]),[provider,setProvider]=useState<Provider>(()=>defaultProvider(board.root,connection.desktop));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[detail,setDetail]=useState<TaskRun|null>(null),[suggested,setSuggested]=useState(false);
  const retry=useRef<string|null>(null),epoch=useRef(0);
  useEffect(()=>{
    const current=++epoch.current;retry.current=null;setRuns([]);setBusy(false);setError('');setDetail(null);setSuggested(false);let active=true,inFlight=false;
    const load=async()=>{if(inFlight)return;inFlight=true;try{const data=await request<{runs:TaskRun[]}>(connection,'/task-runs?'+new URLSearchParams({boardId:board.id,noteId:note.id,projectPath:board.root}));if(!Array.isArray(data?.runs))throw Error(l('Update the PC host to use task runs.','Обновите хост ПК для запуска задач.'));if(active&&current===epoch.current)setRuns(data.runs);}catch(e){if(active)setError((e as Error).message);}finally{inFlight=false;}};
    void load();const timer=setInterval(()=>void load(),5000);return()=>{active=false;epoch.current++;clearInterval(timer);};
  },[connection.url,connection.token,board.id,note.id]);
  function open(run:TaskRun,draft?:string){const chat=taskRunChat(connection,board,note,run,ru,draft);if(chat)onChat(chat);}
  async function create(){
    if(busy||unsaved)return;const current=epoch.current;setBusy(true);setError('');retry.current??=crypto.randomUUID();
    try{const run=await request<TaskRun>(connection,'/task-runs',{id:retry.current,root:board.root,boardId:board.id,noteId:note.id,noteRevision:String(board.repositoryRevision??board.revision),provider});
      if(current!==epoch.current)return;retry.current=null;try{localStorage.setItem(providerKey(board.root),provider);}catch{/* Remember for this session only. */}
      setRuns(old=>[run,...old.filter(value=>value.id!==run.id)]);if(!run.worktree)throw Error(run.error||l('Working copy could not be created.','Не удалось создать рабочую копию.'));open(run);
    }catch(e){if(current===epoch.current)setError((e as Error).message);}finally{if(current===epoch.current)setBusy(false);}
  }
  const latest=runs[0],started=latest&&['prepared','working','questions','checks'].includes(taskDisplayStage(latest))&&['idea','questions','ready'].includes(note.status);
  return <section className="board-task-runs" aria-label={l('Task runs','Выполнение задачи')}>
    <strong>{l('Implementation','Выполнение')}</strong>
    {runs.map(run=>{const stage=taskDisplayStage(run),plan=run.verificationPlan?.length||run.verification?.evidence.length||0,passed=run.verification?.evidence.filter(check=>check.passed).length||0;
      return <button key={run.id} type="button" className="task-run-row" onClick={()=>setDetail(run)}><MessageSquare size={16}/><span className="task-run-row-main"><span>{providerName(run.provider)} · <span className={'task-stage-text task-stage-'+stage}>{taskStageLabel(stage)}</span></span>{plan>0&&<small>{t('проверки {0}/{1}',passed,plan)}</small>}</span><time dateTime={new Date(run.updatedAt).toISOString()} title={fullTime(run.updatedAt)}>{relativeTime(run.updatedAt)}</time></button>;})}
    {onNoteStatus&&started&&!unsaved&&!suggested&&<div className="task-status-suggestion"><p>{t('Задача запущена. Перевести карточку в «В работе»?')}</p><button type="button" onClick={()=>void onNoteStatus({status:'working'}).then(ok=>{if(ok)setSuggested(true);})}>{t('Перевести в «В работе»')}</button></div>}
    <p className="muted">{l('A task gets a separate Git working copy at the current commit. Uncommitted files stay in the original project. Sending the prepared prompt starts the AI.','Задача получает отдельную рабочую копию Git из текущего коммита. Незакоммиченные файлы остаются в исходном проекте. AI начнёт работу после отправки подготовленного запроса.')}</p>
    {unsaved&&<p role="status">{l('Save the note before preparing a task.','Сохраните заметку перед подготовкой задачи.')}</p>}
    <div className="task-run-start"><label>{l('Provider','Провайдер')}<select disabled={busy} value={provider} onChange={e=>{retry.current=null;setProvider(e.target.value as Provider);}}><option value="claude">Claude Code</option><option value="codex">Codex</option><option value="copilot">GitHub Copilot</option></select></label><button type="button" disabled={busy||unsaved} onClick={()=>void create()}><Play size={16}/>{busy?l('Preparing…','Подготовка…'):l('Prepare task chat','Подготовить чат задачи')}</button></div>
    {error&&<p role="alert">{error}</p>}
    {detail&&<TaskRunPanel connection={connection} initial={detail} noteStatus={note.status} onNoteStatus={unsaved?undefined:onNoteStatus} onClose={()=>setDetail(null)} onChat={(run,draft)=>{setDetail(null);open(run,draft);}}/>}
  </section>;
}
