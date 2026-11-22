import {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useLanguage} from './i18n';
import {parseMarkdownTasks, type MarkdownSource} from './markdown-task-batch';
import {useModal} from './navigation';
import './markdown-task-dialog.css';
import type {MarkdownChainControls} from './MarkdownChainPanel';
import type {ChainSourceInput,MarkdownChainDetail} from './markdown-chain';
import {ProjectSourcePicker,sourceFileBinding,sourceFileLabel} from './ProjectSourcePicker';
import {MarkdownTaskEditor,type MarkdownTaskDraft} from './MarkdownTaskEditor';
import {ImproveTaskText,type ImproveScope} from './ImproveTaskText';

export type MarkdownSelection = { main?: File; children: File[] };
type Selection=MarkdownSelection;
type Batch = ReturnType<typeof parseMarkdownTasks>;
type Preview = { selection: Selection; batch?: Batch; sourceFiles?:ChainSourceInput[]; uploadBytes?:number; error?: string };
type Props = {
  onClose(): void; onPrepare?(value: string): void; maxLength: number; manual?:boolean;
  controls?:MarkdownChainControls; improveScope?:ImproveScope; onStarted(chain:MarkdownChainDetail):void;
  initialSelection?:MarkdownSelection;onPlan?(selection:MarkdownSelection,parallelSubtasks:boolean):void;initialParallelSubtasks?:boolean;
};

async function readSource(file: File): Promise<MarkdownSource> {
  return {...sourceFileBinding(file), text: await file.text()};
}

function diagnostic(message: string, ru: boolean) {
  if (!ru) return message;
  if (message === 'Select task files or add level-two task headings.') {
    return 'Добавьте файлы задач или выберите файл с заголовками ##.';
  }
  return message
    .replace(/^Ambiguous task file: /, 'Несколько файлов соответствуют задаче — ')
    .replace(/^Empty context file: /, 'Пустой файл контекста — ')
    .replace(/^Empty task: /, 'Пустое описание задачи — ');
}

function batchPrompt(batch: MarkdownTaskDraft, ru: boolean) {
  const instruction = ru
    ? 'Выполни задачи по порядку в этом чате. Ниже приведены общий контекст и тексты задач из выбранных файлов. Проверяй результат перед переходом к следующей задаче. При ошибке или нехватке информации остановись и укажи, что уже выполнено и какие задачи остались.'
    : 'Run these tasks in order in this chat. Use the shared context and the task descriptions supplied below from the selected files. Verify each result before continuing. If a task fails or needs more information, stop and report completed and remaining tasks.';
  return [
    instruction,
    (ru ? 'Общий контекст' : 'Shared context') + ' (' + batch.name + ')\n' + batch.context,
    ...batch.tasks.map((task, index) => '## ' + (index + 1) + '. ' + task.title + '\n' + task.source + '\n\n' + task.body)
  ].join('\n\n');
}

export function MarkdownTaskDialog({onClose, onPrepare, maxLength, controls, improveScope, onStarted,manual=false,initialSelection,onPlan,initialParallelSubtasks=true}: Props) {
  const ru = useLanguage() === 'ru';
  const heading = useId();
  const [parallelSubtasks,setParallelSubtasks]=useState(initialParallelSubtasks);
  const panel = useRef<HTMLElement>(null);
  useModal(panel, true, onClose);
  const [selection, setSelection] = useState<Selection>(initialSelection??{children: []});
  const [preview, setPreview] = useState<Preview>();
  const [starting,setStarting]=useState(false),[launchError,setLaunchError]=useState('');
  const [draft,setDraft]=useState<MarkdownTaskDraft|undefined>(()=>manual?{name:'',context:'',tasks:[{title:'',body:'',source:'Markdown'}]}:undefined);
  const [editing,setEditing]=useState(manual);
  const attempt=useRef<{signature:string;id:string}|null>(null),locked=useRef(false),mounted=useRef(false);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  useEffect(()=>{setLaunchError('');},[selection]);
  const main = selection.main;

  useEffect(() => {
    if (!main) return;
    let current = true;
    async function read(selectedMain: File) {
      const files = [selectedMain, ...selection.children];
      if (files.some(file => !/\.md$/i.test(file.name))) {
        throw Error(ru ? 'Выберите файлы с расширением .md.' : 'Choose files with the .md extension.');
      }
      // UTF-8 takes up to four bytes per character. Check before allocating the file contents.
      if (files.reduce((total, file) => total + file.size, 0) > Math.max(maxLength,controls?1024*1024:0) * 4) {
        throw Error(ru ? 'Выбранные файлы слишком велики для одной очереди.' : 'The selected files are too large for one batch.');
      }
      const [context, ...children] = await Promise.all(files.map(readSource));
      if (current) {
        const tasks = children.filter(child => child.name !== context.name || child.text !== context.text || child.projectPath!==context.projectPath);
        const sources=[context,...tasks];
        if(new Set(sources.map(file=>file.name)).size!==sources.length)
          throw Error(ru?'Выберите файлы с различимыми именами или укажите их папки в проекте.':'Choose uniquely named files or select their folders in the project.');
        const sourceFiles=sources.map(file=>file.projectPath?{name:file.name,projectPath:file.projectPath}:{name:file.name,text:file.text});
        const uploadBytes=sourceFiles.reduce((sum,file)=>sum+(file.text?new TextEncoder().encode(file.text).length:0),0);
        setPreview({selection, batch: parseMarkdownTasks(context, tasks),sourceFiles,uploadBytes});
      }
    }
    read(main).catch(error => {
      if (current) setPreview({selection, error: error instanceof Error ? error.message : String(error)});
    });
    return () => { current = false; };
  }, [selection, main, maxLength, ru, !!controls]);

  const result = preview?.selection === selection ? preview : undefined;
  const batch = result?.batch;
  const proseOnly=batch?.errors.length===1&&batch.errors[0]==='Select task files or add level-two task headings.';
  const canPlan=!!batch&&!batch.missing.length&&(batch.errors.length===0||proseOnly);
  const plan=draft||(main&&batch?.tasks.length&&!batch.missing.length&&!batch.errors.length
    ? {name:main.name,context:batch.context,tasks:batch.tasks,sourceFiles:result?.sourceFiles}:undefined);
  const valid=plan&&plan.name.trim()&&plan.tasks.length&&plan.tasks.every(task=>task.title.trim()&&task.body.trim());
  const prompt=valid?batchPrompt(plan,ru):'';
  const oversized = prompt.length > maxLength;
  const largeUpload=(result?.uploadBytes??0)>1024*1024;
  const children = selection.children;
  async function startChain(){
    if(!controls||controls.canStart===false||!plan||!prompt||largeUpload||locked.current)return;
    locked.current=true;setStarting(true);setLaunchError('');
    const signature=JSON.stringify([plan,parallelSubtasks]);
    if(attempt.current?.signature!==signature)attempt.current={signature,id:crypto.randomUUID()};
    try{
      const chain=await controls.start({id:attempt.current.id,...plan,parallelSubtasks});
      if(mounted.current)onStarted(chain);
    }catch(error){if(mounted.current)setLaunchError(error instanceof Error?error.message:String(error));}
    finally{locked.current=false;if(mounted.current)setStarting(false);}
  }
  return createPortal(<div className="modal-backdrop">
    <section ref={panel} className="confirm-modal markdown-task-dialog" role="dialog" aria-modal="true" aria-labelledby={heading}>
      <header><h2 id={heading}>{manual?(ru?'Создать задачу':'Create task'):(ru?'Задачи из Markdown':'Markdown tasks')}</h2>
        {controls&&<p className="markdown-project">{ru?'Проект цепочки':'Chain project'} · {controls.cwd}</p>}
      </header>
      {!draft&&<>
      <label>{ru ? 'Основной контекст (.md)' : 'Main context (.md)'}
        <input type="file" accept=".md" disabled={starting} onChange={event => {
          const selectedMain = event.target.files?.[0];
          if (selectedMain) setSelection(prev => ({...prev, main: selectedMain}));
        }}/>
      </label>
      {improveScope&&<ProjectSourcePicker connection={improveScope.connection} cwd={improveScope.cwd} markdownOnly disabled={starting}
        label={ru?'Контекст из проекта':'Context from project'} onPick={file=>setSelection(prev=>({...prev,main:file}))}/>}
      {main&&<small>{sourceFileLabel(main)}</small>}
      <label>{ru ? 'Файлы задач (.md)' : 'Task files (.md)'}
        <input type="file" accept=".md" multiple disabled={starting} onChange={event => {
          const added = Array.from(event.target.files || []);
          if (!added.length) return;
          event.target.value = '';
          setSelection(prev => ({...prev, children: [...prev.children, ...added]}));
        }}/>
      </label>
      {improveScope&&<ProjectSourcePicker connection={improveScope.connection} cwd={improveScope.cwd} markdownOnly disabled={starting}
        label={ru?'Файлы задач из проекта':'Task files from project'} onPick={file=>setSelection(prev=>({...prev,children:[...prev.children,file]}))}/>}
      {!!children.length && <details className="markdown-task-files">
        <summary>{ru ? 'Выбранные файлы' : 'Selected files'} ({children.length})</summary>
        <ul>{children.map((file, index) => <li key={index}>
          <span>{sourceFileLabel(file)}</span>
          <button type="button" className="text-button" disabled={starting} aria-label={(ru ? 'Убрать ' : 'Remove ') + file.name}
            onClick={() => setSelection(prev => ({...prev, children: prev.children.filter((_, i) => i !== index)}))}>
            {ru ? 'Убрать' : 'Remove'}
          </button>
        </li>)}</ul>
      </details>}
      {main&&batch&&(plan||batch.context.trim())&&<div className="markdown-split-actions">
        {onPlan&&<button type="button" className="secondary" disabled={!canPlan||starting} onClick={()=>onPlan({main,children:children.filter(child=>sourceFileLabel(child)!==sourceFileLabel(main))},parallelSubtasks)}>{ru?'Разбить с ИИ':'Split with AI'}</button>}
        {!plan&&<button type="button" className="secondary" disabled={starting} onClick={()=>{
          setDraft({name:main.name,context:batch.context,tasks:[{title:'',body:'',source:sourceFileLabel(main)}],sourceFiles:result?.sourceFiles});setEditing(true);
        }}>{ru?'Разбить вручную':'Split manually'}</button>}
      </div>}
      {!main && <p>{ru ? 'Выберите общий контекст и файлы с описаниями задач. Если задачи записаны под заголовками ##, достаточно одного файла.' : 'Choose a context file and its task files. For tasks under ## headings, choose just the context file.'}</p>}
      {!main&&<button type="button" className="secondary" onClick={()=>{setDraft({name:'',context:'',tasks:[{title:'',body:'',source:'Markdown'}]});setEditing(true);}}>
        {ru?'Ввести задачи вручную':'Enter tasks manually'}
      </button>}
      {main && !result && <p role="status">{ru ? 'Читаем файлы…' : 'Reading files…'}</p>}
      </>}
      {editing&&draft&&<MarkdownTaskEditor draft={draft} onChange={setDraft} disabled={starting} scope={improveScope}/>}
      {plan&&!editing && <section aria-label={ru ? 'Порядок запуска' : 'Run order'}>
        <h3>{ru ? 'Порядок запуска' : 'Run order'} ({plan.tasks.length})</h3>
        <ol className="markdown-preview-steps">{plan.tasks.map((task, index) => <li key={index}><div>
          <details><summary>{task.title}</summary><pre>{task.body}</pre></details>
          {improveScope&&<ImproveTaskText {...improveScope} field="instructions" value={task.body}
            context={[plan.name,plan.context,task.title].filter(Boolean).join('\n\n')} maxLength={1048576} disabled={starting}
            onApply={body=>setDraft({...plan,tasks:plan.tasks.map((step,i)=>i===index?{...step,body}:step)})}/>}
        </div></li>)}</ol>
      </section>}
      {plan&&<button type="button" className="text-button" disabled={starting||(editing&&!valid)} onClick={()=>{setDraft(plan);setEditing(!editing);}}>
        {editing?(ru?'Посмотреть порядок':'Preview order'):(ru?'Редактировать задачи':'Edit tasks')}
      </button>}
      {!draft&&batch && !batch.tasks.length && !!batch.order.length && <details>
        <summary>{ru ? 'Порядок запуска' : 'Run order'} ({batch.order.length})</summary>
        <ol>{batch.order.map((entry, index) => <li key={index}>
          {entry.title}{entry.missing && (ru ? ' — файл отсутствует' : ' — file missing')}
        </li>)}</ol>
      </details>}
      {!draft&&batch && !!batch.missing.length && <div role="alert">
        <h3>{ru ? 'Не хватает файлов задач' : 'Missing task files'}</h3>
        <ul>{batch.missing.map(name => <li key={name}>{name}</li>)}</ul>
      </div>}
      {!draft&&!proseOnly&&batch?.errors.map((message, index) => <p key={index} role="alert">{diagnostic(message, ru)}</p>)}
      {result?.error && <p role="alert">{result.error}</p>}
      {oversized && <p role="alert">{ru ? 'Черновик превышает лимит символов' : 'Draft exceeds the character limit'} ({maxLength}).</p>}
      {launchError&&<p role="alert" className="error-banner">{launchError}</p>}
      {controls&&largeUpload&&<p role="alert">{ru?'Для цепочки можно загрузить до 1 МиБ текста. Выберите файлы из проекта или сократите набор.':'A chain accepts up to 1 MiB of uploaded text. Select project files or reduce the upload.'}</p>}
      {controls&&<label className="chain-delegation"><input type="checkbox" disabled={starting} checked={parallelSubtasks} onChange={e=>setParallelSubtasks(e.target.checked)}/>{ru?'Разрешить параллельные подзадачи':'Allow parallel subtasks'}</label>}
      <footer>
        <button type="button" className="secondary" onClick={onClose}>{ru ? 'Отмена' : 'Cancel'}</button>
        {onPrepare&&<button type="button" className={controls?'secondary':'primary'} disabled={starting || !prompt || oversized} onClick={() => onPrepare(prompt)}>
          {ru ? 'Подготовить черновик' : 'Prepare draft'}
        </button>}
        {controls&&<button type="button" className="primary" disabled={!prompt||starting||largeUpload||controls.canStart===false} onClick={()=>void startChain()}>
          {starting?(ru?'Запуск…':'Starting…'):(ru?'Запустить связанные чаты':'Start linked chats')}
        </button>}
      </footer>
    </section>
  </div>, document.body);
}
