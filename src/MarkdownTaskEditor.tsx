import {useLanguage} from './i18n';
import {useId,useState} from 'react';
import {ImproveTaskText,type ImproveScope} from './ImproveTaskText';
import type {ChainSourceInput,MarkdownChainStep} from './markdown-chain';
import {ProjectSourcePicker,sourceFileBinding} from './ProjectSourcePicker';

type TaskText=Pick<MarkdownChainStep,'title'|'body'|'source'>;
export type MarkdownTaskDraft={name:string;context:string;tasks:TaskText[];sourceFiles?:ChainSourceInput[]};

export function MarkdownTaskEditor({draft,scope,onChange,disabled}:{
  draft:MarkdownTaskDraft;scope?:ImproveScope;onChange(next:MarkdownTaskDraft):void;disabled:boolean;
}){
  const ru=useLanguage()==='ru';
  const prefix=useId();
  const [sourceError,setSourceError]=useState('');
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
  const field=(key:string,label:string,kind:'title'|'context'|'instructions',value:string,context:string,maxLength:number,apply:(next:string)=>void)=>(
    <div className="markdown-edit-field">
      <label htmlFor={prefix+key}>{label}</label>
      {scope&&<ImproveTaskText {...scope} field={kind} value={value} context={context} maxLength={maxLength} onApply={apply} disabled={disabled}/>}
      {kind==='title'?<input id={prefix+key} value={value} maxLength={maxLength} onChange={e=>apply(e.target.value)}/>
        :<textarea id={prefix+key} rows={3} value={value} maxLength={maxLength} onChange={e=>apply(e.target.value)}/>}
    </div>
  );
  return <fieldset disabled={disabled} className="markdown-task-editor" aria-label={ru?'Редактор задач':'Task editor'}>
    {field('name',ru?'Название цепочки':'Chain name','title',draft.name,[draft.context,titles].filter(Boolean).join('\n'),512,name=>onChange({...draft,name}))}
    {field('context',ru?'Общий контекст':'Shared context','context',draft.context,[draft.name,titles].filter(Boolean).join('\n'),1048576,context=>onChange({...draft,context}))}
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
    <button type="button" className="secondary" disabled={draft.tasks.length>=500} onClick={()=>onChange({...draft,tasks:[...draft.tasks,{title:'',body:'',source:draft.sourceFiles?.[0]?.name||'Markdown'}]})}>
      {ru?'Добавить шаг':'Add step'}
    </button>
  </fieldset>;
}
