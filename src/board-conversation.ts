import type {Connection} from './api';
import type {BoardChat} from './WorkBoards';
import type {WorkspaceProvider} from './preferences';

type Conversation={version:1;generation:string;provider:WorkspaceProvider;sessionId?:string;jobId?:string};
export type BoardConversationRef={key:string;generation:string};
const prefix='pocket-board-conversation-v1:';
export function readBoardConversation(key:string):Conversation|null{
 if(!key.startsWith(prefix))return null;
 const raw=localStorage.getItem(key);if(!raw)return null;
 try{const value=JSON.parse(raw);return value?.version===1&&typeof value.generation==='string'&&/^[a-f0-9-]{36}$/.test(value.generation)&&['claude','codex','copilot'].includes(value.provider)&&[value.sessionId,value.jobId].every(id=>id===undefined||typeof id==='string'&&id.length>0&&id.length<=512)?value:null;}catch{return null;}
}
export function currentBoardConversation(ref:BoardConversationRef){try{return readBoardConversation(ref.key)?.generation===ref.generation;}catch{return false;}}
export function attachBoardConversation(ref:BoardConversationRef,provider:WorkspaceProvider,sessionId?:string,jobId?:string){
 const prior=readBoardConversation(ref.key);if(!prior||prior.generation!==ref.generation||(prior.provider!==provider&&(prior.sessionId||prior.jobId))||prior.sessionId&&sessionId&&prior.sessionId!==sessionId||!prior.sessionId&&prior.jobId&&jobId&&prior.jobId!==jobId)return false;
 const value={...prior,provider,...(sessionId?{sessionId}:{}),...(jobId?{jobId}:{})};localStorage.setItem(ref.key,JSON.stringify(value));return true;
}
/** Private device storage only. Repository boards never contain chat associations. */
export async function prepareBoardConversation(connection:Connection,target:BoardChat,provider:WorkspaceProvider,replace=false):Promise<BoardChat>{
 if(!target.context)return target;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([connection.url,connection.token,Boolean(connection.desktop),connection.workspaceId||'',target.root,target.boardId])));
 const key=prefix+[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
 const prior=readBoardConversation(key),value:Conversation=!replace&&prior?prior:{version:1,generation:crypto.randomUUID(),provider};
 if(replace||!prior)localStorage.setItem(key,JSON.stringify(value));
 return {...target,conversation:{key,generation:value.generation},resumeJobId:value.jobId,note:{...target.note,chat:value.sessionId||value.jobId?{provider:value.provider,sessionId:value.sessionId||'pending-'+value.jobId}:undefined}};
}
