import {request,type Connection} from './api';
import {imageBlob} from './image-thumbnails';
import type {BoardNote} from '../server/boards';
export type BoardImage=NonNullable<BoardNote['images']>[number];
export const boardImageMime='application/x-pocket-board-image';
type Drag={id:string;connection:Connection;root:string;image:BoardImage;expires:number};
let active:Drag|null=null;
const queued:(Drag&{boardId:string})[]=[];
export function queueBoardImage(connection:Connection,root:string,boardId:string,image:BoardImage){
 queued.push({id:crypto.randomUUID(),connection:{...connection},root,boardId,image:{...image},expires:Date.now()+60000});while(queued.length>10)queued.shift();window.dispatchEvent(new Event('pocket-board-images'));
}
export function takeQueuedBoardImages(connection:Connection,root:string,boardId:string){
 const images:BoardImage[]=[];
 for(let i=queued.length-1;i>=0;i--){const value=queued[i];if(value.expires<=Date.now()){queued.splice(i,1);continue;}if(value.root===root&&value.boardId===boardId&&sameImageConnection(value.connection,connection)){images.unshift(value.image);queued.splice(i,1);}}
 return images;
}
export const sameImageConnection=(a:Connection,b:Connection)=>a.url===b.url&&a.token===b.token&&Boolean(a.desktop)===Boolean(b.desktop)&&a.workspaceId===b.workspaceId;
export function startBoardImageDrag(data:DataTransfer,connection:Connection,root:string,image:BoardImage){
 active={id:crypto.randomUUID(),connection:{...connection},root,image:{...image},expires:Date.now()+60000};
 data.setData(boardImageMime,active.id);data.effectAllowed='copy';
}
export function takeBoardImageDrag(data:DataTransfer,connection:Connection,root:string){
 const value=active;active=null;
 return value&&value.id===data.getData(boardImageMime)&&value.expires>Date.now()&&value.root===root&&sameImageConnection(value.connection,connection)?value.image:null;
}
export function boardGalleryImages(notes:Pick<BoardNote,'images'>[]){return [...new Map(notes.flatMap(note=>note.images||[]).map(image=>[image.path,image])).values()];}
export async function boardImageFile(connection:Connection,root:string,image:BoardImage){
 const result=await request<{mimeType:string;data:string}>(connection,'/project-board/image?'+new URLSearchParams({root,path:image.path}));
 if(!['image/png','image/jpeg','image/webp'].includes(result.mimeType)||result.data.length>13981016)throw Error('Invalid board image');
 const blob=await imageBlob(`data:${result.mimeType};base64,${result.data}`);
 if(blob.size>10*1024*1024)throw Error('Board image exceeds 10 MB');
 const extension=result.mimeType==='image/jpeg'?'jpg':result.mimeType==='image/webp'?'webp':'png';
 const title=image.caption.replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').trim().slice(0,120)||'Board image';
 return new File([blob],title.replace(/\.(png|jpe?g|webp)$/i,'')+'.'+extension,{type:result.mimeType});
}
