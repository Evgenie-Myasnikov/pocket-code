import {useLanguage} from './i18n';
import {ImproveTaskText,type ImproveScope} from './ImproveTaskText';
import type {MarkdownChainStep} from './markdown-chain';

type TaskText=Pick<MarkdownChainStep,'title'|'body'|'source'>;
export type MarkdownTaskDraft={name:string;context:string;tasks:TaskText[]};

export function MarkdownTaskEditor({draft,scope,onChange,disabled}:{
  draft:MarkdownTaskDraft;scope?:ImproveScope;onChange(next:MarkdownTaskDraft):void;disabled:boolean;
}){
  const ru=useLanguage()==='ru';
  function changeTask(index:number,field:'title'|'body',value:string){
    onChange({...draft,tasks:draft.tasks.map((task,i)=>i===index?{...task,[field]:value}:task)});
  }
  const titles=draft.tasks.map(task=>task.title).filter(Boolean).join('\n');
  const field=(label:string,kind:'title'|'context'|'instructions',value:string,context:string,maxLength:number,apply:(next:string)=>void)=>(
    <div className="markdown-edit-field">
      <label>{label}
        {kind==='title'?<input value={value} maxLength={maxLength} onChange={e=>apply(e.target.value)}/>
          :<textarea rows={3} value={value} maxLength={maxLength} onChange={e=>apply(e.target.value)}/>}
      </label>
      {scope&&<ImproveTaskText {...scope} field={kind} value={value} context={context} maxLength={maxLength} onApply={apply} disabled={disabled}/>}
    </div>
  );
  return <fieldset disabled={disabled} className="markdown-task-editor">
    <legend>{ru?'Редактор задач':'Task editor'}</legend>
    {field(ru?'Название цепочки':'Chain name','title',draft.name,[draft.context,titles].filter(Boolean).join('\n'),512,name=>onChange({...draft,name}))}
    {field(ru?'Общий контекст':'Shared context','context',draft.context,[draft.name,titles].filter(Boolean).join('\n'),1048576,context=>onChange({...draft,context}))}
    {draft.tasks.map((task,i)=><fieldset key={i} className="markdown-step-editor">
      <legend>{ru?'Шаг':'Step'} {i+1}</legend>
      {field(ru?'Название шага':'Step title','title',task.title,[draft.name,draft.context,task.body].filter(Boolean).join('\n\n'),4096,value=>changeTask(i,'title',value))}
      {field(ru?'Инструкция':'Instructions','instructions',task.body,[draft.name,draft.context,task.title].filter(Boolean).join('\n\n'),1048576,value=>changeTask(i,'body',value))}
      {task.source==='Markdown'&&draft.tasks.length>1&&<button type="button" className="text-button" onClick={()=>onChange({...draft,tasks:draft.tasks.filter((_,index)=>index!==i)})}>{ru?'Убрать шаг':'Remove step'}</button>}
    </fieldset>)}
    <button type="button" className="secondary" disabled={draft.tasks.length>=500} onClick={()=>onChange({...draft,tasks:[...draft.tasks,{title:'',body:'',source:'Markdown'}]})}>
      {ru?'Добавить шаг':'Add step'}
    </button>
  </fieldset>;
}
