import {readBoardSnapshot} from './board-snapshots.js';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import type {BoardNote} from './boards.js';

const stableId=(value:string)=>{const h=createHash('sha256').update(value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
/** Uses the project's recorded changes; never invents future tasks or completion. */
export function roadmapFromChangelog(text:string){
 const entries=text.split(/(?=^## (?:\d{4}-\d{2}-\d{2}|\[?\d+\.\d+\.\d+))/m).map(block=>{
   const heading=block.split(/\r?\n/)[0],version=heading.match(/^## \[?(\d+\.\d+\.\d+)/)?.[1]||heading.match(/\((\d+\.\d+\.\d+)\)/)?.[1];
   return {block,heading,version};
 }).filter(entry=>entry.version);
 const versions=[...new Set(entries.map(entry=>entry.version!))].slice(0,6).reverse();
 const notes:BoardNote[]=[];
 for(const [column,version] of versions.entries()){
   const matching=entries.filter(entry=>entry.version===version),recordedRelease=matching.some(entry=>/^- (Release|Follow-up):.*Published v/m.test(entry.block));
   const changes=matching.flatMap(entry=>entry.block.split(/\r?\n/).filter(line=>/^- (Changed|Added|Improved|Fixed):/.test(line)||/^## \[?\d+\.\d+\.\d+/.test(entry.heading)&&/^- (?:boards|chat|rules|docs|navigation):/.test(line))).slice(0,3);
   if(!changes.length)changes.push(matching[0].heading.replace(/^## /,''));
   changes.forEach((change,row)=>{const content=change.replace(/^- \w+: /,'');notes.push({id:stableId('pocket-code:'+version+':'+row),title:content.split(/\. (?=[A-Z])/)[0].slice(0,160),description:`CHANGELOG.md · ${version}\n\n${content}\n\n${recordedRelease?'Release publication recorded in the changelog.':'Recorded change; release publication is not recorded in this entry.'}`,branch:version,status:recordedRelease?'done':'review',owner:'',assigneeIds:[],priority:'normal',x:(column+1)*340+20,y:92+row*320,dependencies:[]});});
 }
 return {versions,notes};
}
export async function readProjectRoadmap(root:string){
 try{const shared=await readBoardSnapshot(root,'board-7b004a10-920c-4ba7-a070-254318083e90.json',false);return {versions:shared.versions,notes:shared.notes.map(note=>({...note,owner:'',assigneeIds:[]}))};}catch(error:any){if(error.code!=='ENOENT')throw error;}
 for(const name of ['CHANGELOG.md','changelog.md'])try{return roadmapFromChangelog(await readFile(path.join(root,name),'utf8'));}catch(error:any){if(error.code!=='ENOENT')throw error;}
 return {versions:[],notes:[] as BoardNote[]};
}
