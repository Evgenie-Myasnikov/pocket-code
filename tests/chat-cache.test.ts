import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readChatCache,writeChatCache,clearChatCache,chatCacheScope} from '../src/chat-cache';
const data:Record<string,string>={};
Object.defineProperty(globalThis,'localStorage',{value:new Proxy({getItem:(k:string)=>data[k]??null,setItem:(k:string,v:string)=>{data[k]=v},removeItem:(k:string)=>{delete data[k]}},{ownKeys:()=>Object.keys(data),getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})})});
test('chat snapshots survive reads, isolate providers/hosts and clear on forget',async()=>{
 const a=await chatCacheScope({url:'http://localhost:1',token:'first'}),b=await chatCacheScope({url:'http://localhost:1',token:'second'});
 assert.notEqual(a,b);assert.equal(a,await chatCacheScope({url:'https://new-tunnel.example',token:'first'}));
 writeChatCache(a,'claude','chat:a',[{id:'last',text:'saved'}]);
 assert.deepEqual(readChatCache(a,'claude','chat:a'),[{id:'last',text:'saved'}]);
 assert.equal(readChatCache(a,'codex','chat:a'),null);assert.equal(readChatCache(b,'claude','chat:a'),null);
 assert.ok(!Object.keys(data).join('').includes('first'));
 clearChatCache();assert.equal(readChatCache(a,'claude','chat:a'),null);
});
test('bounded cache retains recent chats and tolerates corrupted storage',()=>{
 for(let n=0;n<30;n++)writeChatCache('host','codex','chat:'+n,'hello');
 const raw=Object.values(data)[0];assert.ok(Object.keys(JSON.parse(raw)).length<=21);
 data['pocket-code-chats-v1:broken:claude']='invalid';
 assert.equal(readChatCache('broken','claude','sessions'),null);
 writeChatCache('broken','claude','sessions',[]);assert.deepEqual(readChatCache('broken','claude','sessions'),[]);
});
