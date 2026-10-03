import type {Connection} from './api';
export type WorkspaceAccess=NonNullable<Connection['workspaceAccess']>;
export function savedWorkspaces(connection:Connection|null):WorkspaceAccess[]{
 const list:WorkspaceAccess[]=[...(connection?.workspaceAccesses||[]),...(connection?.workspaceAccess?[connection.workspaceAccess]:[]),...(connection?.workspaceOnly&&connection.workspaceId?[connection]:[])];
 return [...new Map(list.map(({url,token,workspaceId,deviceId,name})=>[url+'\0'+workspaceId,{url,token,workspaceId,deviceId,name}])).values()];
}
export function rememberWorkspace(list:WorkspaceAccess[],access:WorkspaceAccess){return [...list.filter(item=>item.url!==access.url||item.workspaceId!==access.workspaceId),access];}
export async function workspaceJoinId(connection:Connection){
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(connection.url+'\0'+connection.token));const key='pocket-workspace-join:'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 try{let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}return id;}catch{return crypto.randomUUID();}
}
