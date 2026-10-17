import {memo,useState} from 'react';
import {Brain,Layers} from 'lucide-react';
import {RichBlock,toolIcon} from './RichBlocks';
import {t,useLanguage} from './i18n';
import {describeTool} from './tool-registry';
import {summarizeActivity,type ActivityBlock} from './activity-groups';
import './activity-groups.css';

/** A run of related calls folds into one line that says what was done: "Explored 5 files · 2 searches". */
export const ActivityGroup=memo(function ActivityGroup({items}:{items:ActivityBlock[]}){
 useLanguage();const [open,setOpen]=useState(false),first=items[0];
 if(items.length===1)return <RichBlock block={first.block} result={first.result} running={first.running}/>;
 const thinking=items.every(item=>item.block.type==='thinking'),views=items.filter(item=>item.block.type==='tool_use').map(item=>describeTool(item.block,item.result,item.running));
 const Icon=thinking?Brain:views.length===items.length&&views.every(view=>view.kind===views[0].kind)?toolIcon(views[0]):Layers;
 const label=thinking?t('Рассуждения'):summarizeActivity(items);
 return <details className="tool-card activity-row activity-group" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary><Icon size={16} aria-hidden="true"/><span>{label}</span>{thinking&&<span className="activity-group-count">×{items.length}</span>}</summary>
  {open&&<div className="activity-group-items">{items.map(item=><RichBlock key={`${item.messageId}:${item.index}`} block={item.block} result={item.result} running={item.running}/>)}</div>}
 </details>;
},(a,b)=>a.items.length===b.items.length&&a.items.every((item,i)=>{const other=b.items[i];return item.block===other.block&&item.result===other.result&&item.running===other.running&&item.messageId===other.messageId&&item.index===other.index;}));
