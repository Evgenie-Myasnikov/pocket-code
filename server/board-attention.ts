import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {HttpError} from './security.js';
import type {BoardNote,ProjectBoard} from './boards.js';
export const boardNotice=z.object({id:z.string(),boardId:z.string(),workspaceId:z.string().optional(),noteId:z.string(),recipientId:z.string(),kind:z.enum(['assigned','question']),title:z.string(),message:z.string(),at:z.number(),readAt:z.number().optional()});
export type BoardNotice=z.infer<typeof boardNotice>;
export const assignees=(n:BoardNote)=>[...new Set(n.assigneeIds?.length?n.assigneeIds:n.assigneeId?[n.assigneeId]:[])];
type State={boards:ProjectBoard[];notices:BoardNotice[];workspaces:{id:string;members:{id:string;needsName?:boolean;approval?:string}[]}[]};
export function allowedRecipients(data:State,board:ProjectBoard){return new Set(['host',...(data.workspaces.find(w=>w.id===board.workspaceId)?.members.filter(m=>!m.needsName&&(!m.approval||m.approval==='approved')).map(m=>m.id)||[])]);}
export function addNotice(data:State,board:ProjectBoard,note:BoardNote,recipientId:string,kind:BoardNotice['kind'],message:string,id:string=randomUUID()){
 if(data.notices.some(n=>n.id===id))return;
 data.notices.unshift({id,boardId:board.id,workspaceId:board.workspaceId,noteId:note.id,recipientId,kind,title:note.title,message,at:Date.now()});
 // Bound each recipient separately so one busy workspace cannot evict another inbox.
 const counts=new Map<string,number>();data.notices=data.notices.filter(n=>{const key=(n.workspaceId||'local')+':'+n.recipientId,count=(counts.get(key)||0)+1;counts.set(key,count);return count<=200;});
}
export function assignmentNotices(data:State,board:ProjectBoard,notes:BoardNote[]){
 const allowed=allowedRecipients(data,board);
 for(const next of notes){const previous=board.notes.find(n=>n.id===next.id),old=previous?assignees(previous):[];
  for(const person of assignees(next)){
   if(!allowed.has(person))throw new HttpError(400,'Choose an approved workspace participant');
   if(!old.includes(person))addNotice(data,board,next,person,'assigned','');
   if(next.status==='questions'&&previous?.status!=='questions')addNotice(data,board,next,person,'question',next.description);
  }
 }
}
