import {request,type Connection} from './api';
import type {BoardConversationHost,SharedConversation} from './board-conversation';

const published=new Map<string,string>();
const providers=['claude','codex','copilot'];
/** Host side of the board chat association. Every failure degrades to the per-device association. */
export function boardConversationHost(connection:Connection):BoardConversationHost{
 const scope=JSON.stringify([connection.url,connection.token,Boolean(connection.desktop),connection.workspaceId||'']);
 return {
  async read(root,boardId){
   try{
    // Opening a board chat never waits long for this: an older or busy host answers "unknown".
    const result=await Promise.race([request<{chat?:SharedConversation|null}>(connection,'/project-board/chat?'+new URLSearchParams({root,board:boardId})),new Promise<undefined>(resolve=>setTimeout(()=>resolve(undefined),4000))]);
    if(!result||typeof result!=='object'||!('chat' in result))return undefined;
    const chat=result.chat;return chat&&providers.includes(chat.provider)&&typeof chat.sessionId==='string'&&chat.sessionId&&!chat.sessionId.startsWith('pending-')?{provider:chat.provider,sessionId:chat.sessionId}:null;
   }catch{return undefined;}
  },
  async write(root,boardId,value){
   const key=scope+'|'+root+'|'+boardId,next=value?value.provider+':'+value.sessionId:'';if(published.get(key)===next)return;published.set(key,next);
   try{await request(connection,'/project-board/chat',{root,board:boardId,sessionId:value?value.sessionId:null,...(value?{provider:value.provider}:{})});}catch{published.delete(key);/* Older hosts keep the association on this device only. */}
  }
 };
}
