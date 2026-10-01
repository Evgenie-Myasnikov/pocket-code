import type {Connection} from './api';

const PREFIX='pocket-code-chats-v1:';
const MAX_BYTES=1_500_000;
export async function chatCacheScope(connection:Connection):Promise<string>{
  // Pairing credentials distinguish hosts/accounts without storing the secret.
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(connection.token));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
type Entry={at:number;value:unknown};
export function readChatCache<T>(scope:string,provider:string,id:string):T|null{
  try{const data=JSON.parse(localStorage.getItem(PREFIX+scope+':'+provider)||'{}');return data[id]?.value??null;}catch{return null;}
}
export function writeChatCache(scope:string,provider:string,id:string,value:unknown){
  try{
    let entries:Record<string,Entry>;
    try{entries=JSON.parse(localStorage.getItem(PREFIX+scope+':'+provider)||'{}');}catch{entries={};}
    entries[id]={at:Date.now(),value};
    const sorted=Object.entries(entries).sort((a,b)=>b[1].at-a[1].at).slice(0,21);
    const kept:Record<string,Entry>={};let size=0;
    for(const [key,entry] of sorted){const bytes=JSON.stringify(entry).length*2;if(size+bytes>MAX_BYTES)continue;kept[key]=entry;size+=bytes;}
    localStorage.setItem(PREFIX+scope+':'+provider,JSON.stringify(kept));
  }catch{/* Storage exhaustion must never prevent reading or sending a chat. */}
}
export function clearChatCache(){
  try{for(const key of Object.keys(localStorage))if(key.startsWith(PREFIX))localStorage.removeItem(key);}catch{/* unavailable storage */}
}
