import {useId,useState} from 'react';
import {Cpu,FileText} from 'lucide-react';
import {CopyAction,Markdown} from './RichBlocks';
import {buildChainStepPrompt,sourceFileLocations,type MarkdownChainDetail} from './markdown-chain';

type Props={chain:MarkdownChainDetail;index:number;provider:string;model?:string;ru:boolean};

export function ChainStepReader({chain,index,provider,model,ru}:Props){
  const step=chain.steps[index];
  const previous=chain.steps[index-1]?.handoff;
  const pages=[
    {id:'task',label:ru?'Задание':'Task',text:step.body},
    ...(chain.context?[{id:'shared',label:ru?'Общий контекст':'Shared context',text:chain.context}]:[]),
    ...(previous?[{id:'previous',label:ru?'Из предыдущего шага':'Previous step',text:previous}]:[]),
    ...(step.handoff?[{id:'handoff',label:ru?'Передача дальше':'Handoff',text:step.handoff}]:[]),
    {id:'paths',label:ru?'Пути':'Paths',text:''},
    {id:'prompt',label:ru?'Полный запрос':'Full prompt',text:''}
  ];
  const [choice,select]=useState('task');
  const active=pages.find(p=>p.id===choice)??pages[0];
  const id=useId();
  return <section className="chain-context" aria-label={ru?'Материалы шага':'Step materials'}>
    <div className="chain-run-settings">
      <span title={step.source}><FileText size={14} aria-hidden="true"/>{step.source}</span>
      <span aria-label={(ru?'Провайдер: ':'Provider: ')+provider}><Cpu size={14} aria-hidden="true"/>{provider}{model&&<code>{model}</code>}</span>
    </div>
    <div className="chain-reader-tabs" role="tablist" aria-label={ru?'Материалы шага':'Step materials'}>
      {pages.map((p,i)=><button key={p.id} type="button" role="tab" id={id+p.id} aria-selected={p.id===active.id}
        tabIndex={p.id===active.id?0:-1} aria-controls={id+'-body'} onClick={()=>select(p.id)}
        onKeyDown={event=>{
          const next=event.key==='ArrowRight'?(i+1)%pages.length:event.key==='ArrowLeft'?(i+pages.length-1)%pages.length:
            event.key==='Home'?0:event.key==='End'?pages.length-1:undefined;
          if(next===undefined)return;
          event.preventDefault();select(pages[next].id);
          document.getElementById(id+pages[next].id)?.focus();
        }}>{p.label}</button>)}
    </div>
    <div key={active.id} id={id+'-body'} className="chain-reader-body" role="tabpanel" aria-labelledby={id+active.id} tabIndex={0}>
      {active.id==='paths'?<StepPaths chain={chain} index={index} ru={ru}/>:active.id==='prompt'?<pre className="chain-raw-prompt">{buildChainStepPrompt(chain,index)}</pre>:<Markdown text={active.text}/>}
    </div>
  </section>;
}

function StepPaths({chain,index,ru}:Pick<Props,'chain'|'index'|'ru'>){
  const step=chain.steps[index];
  const row=(label:string,value:string)=> <div className="chain-path-row"><dt>{label}</dt><dd><code>{value}</code><CopyAction compact text={value} label={ru?'Копировать путь':'Copy path'}/></dd></div>;
  return <div className="chain-paths">
    <dl>{row(ru?'Проект':'Project',chain.cwd)}
      {step.worktreeCwd&&step.worktreeCwd!==step.launchCwd&&row(ru?'Рабочее дерево':'Worktree',step.worktreeCwd)}
      {(step.launchCwd||step.worktreeCwd)&&row(ru?'Рабочая папка шага':'Step working directory',(step.launchCwd||step.worktreeCwd)!)}
    </dl>
    {sourceFileLocations(chain,step).map(file=><section key={file.name}>
      <h4>{file.name}</h4>
      <dl>{file.projectPath&&row(ru?'В проекте':'Project file',file.projectPath)}
        {file.worktreePath&&row(ru?'В рабочей копии':'Working copy',file.worktreePath)}
        {file.uploadPath&&row(ru?'Копия вложения на ПК':'Attachment on host',file.uploadPath)}
      </dl>
      {!file.projectPath&&!file.uploadPath&&<small>{ru?'Вложение':'Attachment'}</small>}
    </section>)}
  </div>;
}
