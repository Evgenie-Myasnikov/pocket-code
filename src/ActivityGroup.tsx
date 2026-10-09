import {memo,useState} from 'react';
import {Terminal,Pencil,Wrench,Brain} from 'lucide-react';
import {RichBlock} from './RichBlocks';
import {t,useLanguage} from './i18n';
import {toolActivity} from './tool-activity';
import type {ActivityBlock} from './activity-groups';
import './activity-groups.css';

export const ActivityGroup=memo(function ActivityGroup({items}:{items:ActivityBlock[]}){
 useLanguage();const [open,setOpen]=useState(false),first=items[0];
 if(items.length===1)return <RichBlock block={first.block} result={first.result} running={first.running}/>;
 const thinking=first.block.type==='thinking',activity=toolActivity(first.block,first.result,first.running);
 const Icon=thinking?Brain:activity.kind==='command'?Terminal:activity.kind==='edit'?Pencil:Wrench;
 const label=thinking?t('Рассуждения'):t(activity.label)+(activity.kind==='tool'&&first.block.name?' · '+first.block.name:'');
 return <details className="tool-card activity-row activity-group" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary><Icon size={16}/><span>{label}</span><span className="activity-group-count">×{items.length}</span></summary>
  {open&&<div className="activity-group-items">{items.map(item=><RichBlock key={`${item.messageId}:${item.index}`} block={item.block} result={item.result} running={item.running}/>)}</div>}
 </details>;
},(a,b)=>a.items.length===b.items.length&&a.items.every((item,i)=>{const other=b.items[i];return item.block===other.block&&item.result===other.result&&item.running===other.running&&item.messageId===other.messageId&&item.index===other.index;}));
