import {memo,useState} from 'react';
import {ListChecks,ChevronRight} from 'lucide-react';
import {RichBlock,ReasoningDisclosure} from './RichBlocks';
import {useLanguage} from './i18n';
import {summarizeActivity,type ActivityBlock} from './activity-groups';
import './activity-groups.css';

/** Fold consecutive routine calls. A single tool already has its own disclosure. */
export const ActivityGroup=memo(function ActivityGroup({items}:{items:ActivityBlock[]}){
 useLanguage();const [open,setOpen]=useState(false);

 if(items[0].block.type==='thinking')return <ReasoningDisclosure paragraphs={items.map(item=>item.block.thinking||'')}/>;
 if(items.length===1){const {block,result,running}=items[0];return <RichBlock block={block} result={result} running={running}/>;}
 return <details className="tool-card activity-row activity-group" data-running={items.some(item=>item.running&&!item.result)||undefined} open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary><ListChecks size={16} aria-hidden="true"/><span>{summarizeActivity(items)}</span><ChevronRight size={12} className="chat-disclosure-chevron" aria-hidden="true"/></summary>
  {open&&<div className="activity-group-items">{items.map(item=><RichBlock key={`${item.messageId}:${item.index}`} block={item.block} result={item.result} running={item.running}/>)}</div>}
 </details>;
},(a,b)=>a.items.length===b.items.length&&a.items.every((item,i)=>{const other=b.items[i];return item.block===other.block&&item.result===other.result&&item.running===other.running&&item.messageId===other.messageId&&item.index===other.index;}));
