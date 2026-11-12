import type {Connection} from './api';
import type {BoardChat} from './WorkBoards';
import type {WorkspaceProvider} from './preferences';

type Conversation={version:1;generation:string;provider:WorkspaceProvider;sessionId?:string;jobId?:string};
export type BoardConversationRef={key:string;generation:string};
export type SharedConversation={provider:WorkspaceProvider;sessionId:string};
/**
 * The PC keeps which chat is a board's current discussion, so the desktop window and every phone resume the same
 * conversation instead of each device starting its own. `undefined` from read means the host cannot say (older host,
 * no connection): the association then stays on this device, as before.
 */
export type BoardConversationHost={read(root:string,boardId:string):Promise<SharedConversation|null|undefined>;write(root:string,boardId:string,value:SharedConversation|null):Promise<void>};
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
async function conversationKey(connection:Connection,target:Pick<BoardChat,'root'|'boardId'>){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([connection.url,connection.token,Boolean(connection.desktop),connection.workspaceId||'',target.root,target.boardId])));
 return prefix+[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
const prepared=(target:BoardChat,key:string,value:Conversation):BoardChat=>({...target,conversation:{key,generation:value.generation},resumeJobId:value.jobId,note:{...target.note,chat:value.sessionId||value.jobId?{provider:value.provider,sessionId:value.sessionId||'pending-'+value.jobId}:undefined}});
/** Device storage holds the association; the host, when it can, says which chat every device should resume. */
export async function prepareBoardConversation(connection:Connection,target:BoardChat,provider:WorkspaceProvider,replace=false,host?:BoardConversationHost):Promise<BoardChat>{
 if(!target.context)return target;
 const key=await conversationKey(connection,target);let prior=readBoardConversation(key);
 if(replace){const value:Conversation={version:1,generation:crypto.randomUUID(),provider};localStorage.setItem(key,JSON.stringify(value));void host?.write(target.root,target.boardId,null);return prepared(target,key,value);}
 const shared=await host?.read(target.root,target.boardId);
 // Another device continued or replaced the board chat: follow it rather than keep a second, diverging conversation.
 if(shared&&shared.sessionId!==prior?.sessionId){prior={version:1,generation:crypto.randomUUID(),provider:shared.provider,sessionId:shared.sessionId};localStorage.setItem(key,JSON.stringify(prior));}
 // This device knows the board chat and the host does not yet: tell it, so other devices resume the same one.
 else if(shared===null&&prior?.sessionId)void host?.write(target.root,target.boardId,{provider:prior.provider,sessionId:prior.sessionId});
 const value:Conversation=prior||{version:1,generation:crypto.randomUUID(),provider};
 if(!prior)localStorage.setItem(key,JSON.stringify(value));
 return prepared(target,key,value);
}
/** A board discussion opened from the chat list becomes the board's current chat: what is written there is what the board shows next time. */
export async function adoptBoardConversation(connection:Connection,target:BoardChat,provider:WorkspaceProvider,sessionId:string,host?:BoardConversationHost):Promise<BoardChat>{
 if(!target.context)return target;
 const key=await conversationKey(connection,target),prior=readBoardConversation(key);
 const value:Conversation=prior&&prior.sessionId===sessionId&&prior.provider===provider?prior:{version:1,generation:crypto.randomUUID(),provider,sessionId};
 if(value!==prior)localStorage.setItem(key,JSON.stringify(value));
 void host?.write(target.root,target.boardId,{provider,sessionId});
 return prepared(target,key,value);
}
