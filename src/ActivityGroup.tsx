import {memo,useState} from 'react';
import {Brain,ChevronRight} from 'lucide-react';
import {RichBlock} from './RichBlocks';
import {useLanguage} from './i18n';
import {type ActivityBlock} from './activity-groups';
import './activity-groups.css';

/** Intermediate activity folds under one shared label: "Explored 5 files · 2 searches". */
export const ActivityGroup=memo(function ActivityGroup({items}:{items:ActivityBlock[]}){
 useLanguage();const [open,setOpen]=useState(false);

 const Icon=Brain;
 return <details className="tool-card activity-row activity-group" data-running={items.some(item=>item.running&&!item.result)||undefined} open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary><Icon size={16} aria-hidden="true"/><span>Thinking</span><ChevronRight size={12} className="chat-disclosure-chevron" aria-hidden="true"/></summary>
  {open&&<div className="activity-group-items">{items.map(item=><RichBlock key={`${item.messageId}:${item.index}`} block={item.block} result={item.result} running={item.running}/>)}</div>}
 </details>;
},(a,b)=>a.items.length===b.items.length&&a.items.every((item,i)=>{const other=b.items[i];return item.block===other.block&&item.result===other.result&&item.running===other.running&&item.messageId===other.messageId&&item.index===other.index;}));
