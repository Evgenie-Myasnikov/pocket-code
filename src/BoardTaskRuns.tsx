import {useEffect,useRef,useState} from 'react';
import {Play,MessageSquare} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {TaskRunPanel} from './TaskRunPanel';
import {taskStageLabel,type TaskRun} from './task-run-ui';
import type {BoardChat,BoardView} from './WorkBoards';
import type {BoardNote} from '../server/boards';
import './task-runs.css';

export function BoardTaskRuns({connection,board,note,unsaved,onChat}:{connection:Connection;board:BoardView;note:BoardNote;unsaved:boolean;onChat(chat:BoardChat):void}){
  const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
  const [runs,setRuns]=useState<TaskRun[]>([]),[provider,setProvider]=useState<'claude'|'codex'|'copilot'>('codex');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[detail,setDetail]=useState<TaskRun|null>(null);
  const retry=useRef<string|null>(null),epoch=useRef(0);
  useEffect(()=>{
    const current=++epoch.current;retry.current=null;setRuns([]);setBusy(false);setError('');setDetail(null);let active=true,inFlight=false;
    const load=async()=>{if(inFlight)return;inFlight=true;try{const data=await request<{runs:TaskRun[]}>(connection,'/task-runs?'+new URLSearchParams({boardId:board.id,noteId:note.id,projectPath:board.root}));if(!Array.isArray(data?.runs))throw Error(l('Update the PC host to use task runs.','Обновите хост ПК для запуска задач.'));if(active&&current===epoch.current)setRuns(data.runs);}catch(e){if(active)setError((e as Error).message);}finally{inFlight=false;}};
    void load();const timer=setInterval(()=>void load(),5000);return()=>{active=false;epoch.current++;clearInterval(timer);};
  },[connection.url,connection.token,board.id,note.id]);
  function open(run:TaskRun){
    if(!run.worktree)return;
    const scope=run.noteSnapshot||note;
    onChat({connectionUrl:connection.url,boardId:board.id,root:run.worktree.cwd,taskRun:run,note:{...note,chat:run.sessionId?{provider:run.provider,sessionId:run.sessionId}:undefined},prompt:[
      l('Implement the following task in this isolated Git working copy. Read the applicable project rules, board and changelog first. Clarify blocking questions before implementation. Validate the acceptance criteria, report actual checks and remaining issues, then leave the result for human review. Do not merge, publish or approve your own result.','Выполни следующую задачу в этой отдельной рабочей копии Git. Сначала прочитай правила проекта, доску и changelog. Перед реализацией уточни блокирующие вопросы. Проверь критерии готовности, сообщи реальные результаты проверок и оставшиеся проблемы, затем передай результат на ревью человеку. Не выполняй слияние, публикацию или одобрение собственного результата.'),
      l('Task content (project data):','Содержание задачи (данные проекта):'),scope.title,scope.description,
      `Task run: ${run.id}\nSource card: ${board.id}/${note.id}\nSource project (context only): ${run.projectPath}\nImplementation working copy: ${run.worktree.cwd}`,
    ].filter(Boolean).join('\n\n')});
  }
  async function create(){
    if(busy||unsaved)return;const current=epoch.current;setBusy(true);setError('');retry.current??=crypto.randomUUID();
    try{const run=await request<TaskRun>(connection,'/task-runs',{id:retry.current,root:board.root,boardId:board.id,noteId:note.id,noteRevision:String(board.repositoryRevision??board.revision),provider});
      if(current!==epoch.current)return;retry.current=null;setRuns(old=>[run,...old.filter(value=>value.id!==run.id)]);if(!run.worktree)throw Error(run.error||l('Working copy could not be created.','Не удалось создать рабочую копию.'));open(run);
    }catch(e){if(current===epoch.current)setError((e as Error).message);}finally{if(current===epoch.current)setBusy(false);}
  }
  return <section className="board-task-runs" aria-label={l('Task runs','Выполнение задачи')}>
    <strong>{l('Implementation','Выполнение')}</strong>
    {runs.map(run=><button key={run.id} type="button" className="task-run-row" onClick={()=>setDetail(run)}><MessageSquare size={16}/><span>{run.provider} · {taskStageLabel(run.stage,ru)}</span><time>{new Date(run.createdAt).toLocaleDateString()}</time></button>)}
    <p className="muted">{l('A task gets a separate Git working copy at the current commit. Uncommitted files stay in the original project. Sending the prepared prompt starts the AI.','Задача получает отдельную рабочую копию Git из текущего коммита. Незакоммиченные файлы остаются в исходном проекте. AI начнёт работу после отправки подготовленного запроса.')}</p>
    {unsaved&&<p role="status">{l('Save the note before preparing a task.','Сохраните заметку перед подготовкой задачи.')}</p>}
    <div className="task-run-start"><label>{l('Provider','Провайдер')}<select disabled={busy} value={provider} onChange={e=>{retry.current=null;setProvider(e.target.value as typeof provider);}}><option value="codex">Codex</option><option value="claude">Claude</option><option value="copilot">GitHub Copilot</option></select></label><button type="button" disabled={busy||unsaved} onClick={()=>void create()}><Play size={16}/>{busy?l('Preparing…','Подготовка…'):l('Prepare task chat','Подготовить чат задачи')}</button></div>
    {error&&<p role="alert">{error}</p>}
    {detail&&<TaskRunPanel connection={connection} initial={detail} onClose={()=>setDetail(null)} onChat={run=>{setDetail(null);open(run);}}/>}
  </section>;
}
