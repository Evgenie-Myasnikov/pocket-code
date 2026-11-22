import {useState,type ReactNode} from 'react';
import {FileUp,Plus} from 'lucide-react';
import {useLanguage} from './i18n';
import {MarkdownChainPanel,type MarkdownChainControls} from './MarkdownChainPanel';
import {MarkdownTaskDialog} from './MarkdownTaskDialog';
import type {ImproveScope} from './ImproveTaskText';
import type {MarkdownChainDetail} from './markdown-chain';
import './tasks-page.css';

type Props={
  controls?:MarkdownChainControls;
  improveScope?:ImproveScope;
  scopePicker?:ReactNode;
  unavailable?:string;
  initialId?:string;
  onPrepareDraft?(prompt:string):void;
  maxDraftLength?:number;
};

export function TasksPage({controls,improveScope,scopePicker,unavailable,initialId,onPrepareDraft,maxDraftLength=1024*1024}:Props){
  const ru=useLanguage()==='ru',title=ru?'Задачи':'Tasks';
  const [create,setCreate]=useState<'manual'|'import'>();
  const [started,setStarted]=useState<MarkdownChainDetail>();
  const available=Boolean(controls)&&controls?.canStart!==false;
  return <section className="tasks-page" aria-label={title}>
    <div className="tasks-page-inner">
      <header className="tasks-page-header">
        <h1>{title}</h1>
        <div className="tasks-page-actions">
          <button type="button" className="secondary" disabled={!available} onClick={()=>setCreate('import')}><FileUp aria-hidden="true" size={16}/>{ru?'Импорт Markdown':'Import Markdown'}</button>
          <button type="button" className="primary" disabled={!available} onClick={()=>setCreate('manual')}><Plus aria-hidden="true" size={17}/>{ru?'Создать задачу':'Create task'}</button>
        </div>
      </header>
      {scopePicker&&<div className="tasks-page-scope">{scopePicker}</div>}
      {unavailable&&<p role="status">{unavailable}</p>}
      {controls&&<MarkdownChainPanel key={started?.id||initialId||'index'} controls={controls} initial={started} initialId={initialId}/>}
    </div>
    {create&&controls&&<MarkdownTaskDialog manual={create==='manual'} maxLength={maxDraftLength} improveScope={improveScope}
      controls={controls} onClose={()=>setCreate(undefined)} onPrepare={onPrepareDraft?prompt=>{setCreate(undefined);onPrepareDraft(prompt);}:undefined}
      onStarted={chain=>{setCreate(undefined);setStarted(chain);}}/>}
  </section>;
}
