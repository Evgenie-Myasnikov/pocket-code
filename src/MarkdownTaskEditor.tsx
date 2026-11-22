import {useLanguage} from './i18n';
import {useId,useRef,useState,type ReactNode} from 'react';
import {ChevronRight,FileUp} from 'lucide-react';
import {ImproveTaskText,type ImproveScope} from './ImproveTaskText';
import type {ChainSourceInput,MarkdownChainStep} from './markdown-chain';
import {ProjectSourcePicker,sourceFileBinding} from './ProjectSourcePicker';

type TaskText=Pick<MarkdownChainStep,'title'|'body'|'source'>;
export type MarkdownTaskDraft={name:string;context:string;tasks:TaskText[];sourceFiles?:ChainSourceInput[]};

export function descriptionTitle(body:string){
  const first=body.trim().split(/\r?\n/,1)[0].replace(/^#{1,6}\s+/,'').trim();
  return first.length>80?first.slice(0,79).trimEnd()+'…':first;
}

export function MarkdownTaskEditor({draft,scope,onChange,disabled,onImport,moreOptions}:{
  draft:MarkdownTaskDraft;scope?:ImproveScope;onChange(next:MarkdownTaskDraft):void;disabled:boolean;
  onImport?(file:File):void;moreOptions?:ReactNode;
}){
  const ru=useLanguage()==='ru';
  const prefix=useId();
  const [sourceError,setSourceError]=useState('');
  const upload=useRef<HTMLInputElement>(null);
  const compact=!!onImport;
  function changeTask(index:number,field:'title'|'body',value:string){
    onChange({...draft,tasks:draft.tasks.map((task,i)=>i===index?{...task,[field]:value}:task)});
  }
  const titles=draft.tasks.map(task=>task.title).filter(Boolean).join('\n');
  function linkSource(file:File,index?:number){
    const binding=sourceFileBinding(file);
    const conflict=draft.sourceFiles?.find(source=>source.name===binding.name && source.projectPath!==binding.projectPath);
    if(conflict){
      setSourceError(ru?'Файл с таким именем уже выбран из другого источника.':'Another selected source has the same name.');
      return;
    }
    setSourceError('');
    const other=(draft.sourceFiles??[]).filter(source=>source.name!==binding.name);
    if(index===undefined){onChange({...draft,sourceFiles:[binding,...other]});return;}
    const sources=(draft.sourceFiles??[]).some(source=>source.projectPath===binding.projectPath)?draft.sourceFiles:[...other,binding];
    onChange({...draft,sourceFiles:sources,tasks:draft.tasks.map((task,i)=>i===index?{...task,source:binding.name}:task)});
  }
  const field=(key:string,label:string,kind:'title'|'context'|'instructions',value:string,context:string,maxLength:number,apply:(next:string)=>void,placeholder?:string)=>(
    <div className="markdown-edit-field">
      <label htmlFor={prefix+key}>{label}</label>
      {scope&&<ImproveTaskText {...scope} field={kind} value={value} context={context} maxLength={maxLength} onApply={apply} disabled={disabled} compact={compact}/>}
      {kind==='title'?<input id={prefix+key} value={value} placeholder={placeholder} maxLength={maxLength} onChange={e=>apply(e.target.value)}/>
        :<textarea id={prefix+key} rows={compact&&kind==='instructions'?5:3} value={value} maxLength={maxLength} onChange={e=>apply(e.target.value)}/>}
    </div>
  );
  const chainName=field('name',ru?'Название цепочки':'Chain name','title',draft.name,[draft.context,titles].filter(Boolean).join('\n'),512,name=>onChange({...draft,name}));
  const sharedContext=field('context',ru?'Общий контекст':'Shared context','context',draft.context,[draft.name,titles].filter(Boolean).join('\n'),1048576,context=>onChange({...draft,context}));
  const addStep=<button type="button" className="secondary" disabled={draft.tasks.length>=500} onClick={()=>onChange({...draft,tasks:[...draft.tasks,{title:'',body:'',source:compact?'Markdown':draft.sourceFiles?.[0]?.name||'Markdown'}]})}>
    {ru?'Добавить шаг':'Add step'}
  </button>;
  if(onImport){
    const task=draft.tasks[0],fromFile=ru?'Из файла':'From file';
    return <fieldset disabled={disabled} className="markdown-task-editor simple-task-editor" aria-label={ru?'Редактор задачи':'Task editor'}>
      {field('body',ru?'Описание':'Description','instructions',task.body,[task.title,draft.context].filter(Boolean).join('\n\n'),1048576,value=>changeTask(0,'body',value))}
      <div className="task-file-action">
        <input type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" hidden ref={upload} aria-label={fromFile} onChange={e=>{
          const file=e.target.files?.[0];e.target.value='';if(file)onImport(file);
        }}/>
        <button className="text-button" type="button" onClick={()=>upload.current?.click()}><FileUp size={15} aria-hidden="true"/>{fromFile}</button>
        {task.source!=='Markdown'&&<small>{task.source}</small>}
      </div>
      {field('title',ru?'Название (необязательно)':'Title (optional)','title',task.title,task.body,512,value=>changeTask(0,'title',value),descriptionTitle(task.body)||(ru?'Из описания задачи':'From the description'))}
      <details className="task-extra-options"><summary><ChevronRight size={14} aria-hidden="true"/>{ru?'Другие параметры':'More options'}</summary><div>
        {scope&&<ProjectSourcePicker connection={scope.connection} cwd={scope.cwd} disabled={disabled} label={ru?'Описание из проекта':'Description from project'} onPick={onImport}/>}
        {draft.name&&chainName}
        {sharedContext}
        {addStep}
        {moreOptions}
      </div></details>
    </fieldset>;
  }
  return <fieldset disabled={disabled} className="markdown-task-editor" aria-label={ru?'Редактор задач':'Task editor'}>
    {chainName}
    {sharedContext}
    {scope&&<ProjectSourcePicker connection={scope.connection} cwd={scope.cwd} disabled={disabled}
      label={ru?'Привязать файл к общему контексту':'Link a shared context file'} onPick={file=>linkSource(file)}/>}
    {!!draft.sourceFiles?.length&&<ul>{draft.sourceFiles.map(file=><li key={file.name}>{file.name}</li>)}</ul>}
    {sourceError&&<p role="alert">{sourceError}</p>}
    {draft.tasks.map((task,i)=><fieldset key={i} className="markdown-step-editor">
      <legend>{ru?'Шаг':'Step'} {i+1}</legend>
      {field('title'+i,ru?'Название шага':'Step title','title',task.title,[draft.name,draft.context,task.body].filter(Boolean).join('\n\n'),4096,value=>changeTask(i,'title',value))}
      {field('body'+i,ru?'Инструкция':'Instructions','instructions',task.body,[draft.name,draft.context,task.title].filter(Boolean).join('\n\n'),1048576,value=>changeTask(i,'body',value))}
      {scope&&<ProjectSourcePicker connection={scope.connection} cwd={scope.cwd} disabled={disabled}
        label={ru?'Привязать файл к шагу':'Link a step file'} onPick={file=>linkSource(file,i)}/>}
      {task.source!=='Markdown'&&<small>{task.source}</small>}
      {draft.tasks.length>1&&<button type="button" className="text-button" onClick={()=>onChange({...draft,tasks:draft.tasks.filter((_,index)=>index!==i)})}>{ru?'Убрать шаг':'Remove step'}</button>}
    </fieldset>)}
    {addStep}
  </fieldset>;
}
