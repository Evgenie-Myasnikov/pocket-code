import type {BoardNote} from '../server/boards';
import {emptyWhiteboard,type Whiteboard} from './whiteboard-model';

// Notes remain the canonical task records; canvas stores their visual geometry.
export function boardCanvas(notes:BoardNote[],canvas?:Whiteboard):Whiteboard {
 const value=canvas||emptyWhiteboard(),ids=new Set(notes.map(n=>n.id));
 return {...value,items:[...value.items.filter(i=>!ids.has(i.id)),...notes.map(n=>{
  const prior=value.items.find(i=>i.id===n.id);
  return {id:n.id,kind:'card' as const,text:n.title,description:n.description,x:n.x,y:n.y,width:prior?.width||280,height:prior?.height||280,color:prior?.color||'sand' as const};
 })],links:[...value.links]};
}
export function canvasMigrationIssues(notes:BoardNote[],canvas?:Whiteboard){
 const result:string[]=[],noteIds=new Set(notes.map(n=>n.id)),items=canvas?.items||[],ids=new Set([...noteIds,...items.map(i=>i.id)]);
 if(noteIds.size!==notes.length||new Set(items.map(i=>i.id)).size!==items.length)result.push('Duplicate object IDs');
 if((canvas?.links||[]).some(l=>(l.from?!ids.has(l.from):!l.fromPoint)||(l.to?!ids.has(l.to):!l.toPoint)||Boolean(l.from&&l.from===l.to)))result.push('Invalid visual connections');
 if(notes.some(n=>n.dependencies.some(id=>!noteIds.has(id)||id===n.id)))result.push('Invalid task dependencies');
 return result;
}
export function canvasNotes(notes:BoardNote[],canvas:Whiteboard):BoardNote[] {
 const ids=new Set(canvas.items.filter(i=>i.kind==='card').map(i=>i.id));
 return canvas.items.filter(i=>i.kind==='card').map(i=>{
  const old=notes.find(n=>n.id===i.id);
  return {...(old||{owner:'',branch:'',status:'idea' as const,priority:'normal' as const,dependencies:[]}),id:i.id,title:i.text.trim().slice(0,160)||'Untitled',description:i.description||'',x:Math.min(20000,i.x),y:Math.min(20000,i.y),dependencies:(old?.dependencies||[]).filter(id=>ids.has(id)||!notes.some(n=>n.id===id))};
 });
}
