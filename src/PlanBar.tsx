import {useState} from 'react';
import {ListChecks,ChevronDown} from 'lucide-react';
import type {ChatMessage} from '../server/types';
import {describeTool,type PlanItem} from './tool-registry';
import {PlanChecklist} from './RichBlocks';
import {t,useLanguage} from './i18n';

/** The newest plan written by TodoWrite or update_plan in this conversation. */
export function latestPlan(messages:ChatMessage[]):PlanItem[]|null{
  for(let m=messages.length-1;m>=0;m--){const blocks=messages[m].blocks;for(let b=blocks.length-1;b>=0;b--){const block=blocks[b];if(block.type!=='tool_use')continue;const view=describeTool(block);if(view.plan?.length)return view.plan;}}
  return null;
}
/** "Plan 2/5 · Fixing email validation" above the composer, opening into the checklist. */
export function PlanBar({items}:{items:PlanItem[]}){
  useLanguage();const [open,setOpen]=useState(false);
  const done=items.filter(item=>item.status==='completed').length,current=items.find(item=>item.status==='in_progress');
  return <section className="plan-bar" data-open={open}>
    <button className="plan-bar-toggle" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><ListChecks size={16} aria-hidden="true"/><span className="plan-bar-count">{t('План {0}/{1}',done,items.length)}</span>{current&&<span className="plan-bar-current">{current.active||current.text}</span>}<ChevronDown size={16} className="plan-bar-chevron" aria-hidden="true"/></button>
    {open&&<PlanChecklist items={items}/>}
  </section>;
}
