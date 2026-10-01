import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {CodexJiraTools} from '../server/jira-codex';
import type {CodexRpc} from '../server/codex-rpc';
class Rpc extends EventEmitter implements CodexRpc{
 calls:{method:string;params:any}[]=[];closed=false;fail=false;ambiguous=false;missing=false;
 async request(method:string,params:any){
  this.calls.push({method,params});
  if(method==='initialize')return {};
  if(method==='thread/start')return {thread:{id:'ephemeral-jira'}};
  if(method==='mcpServerStatus/list'){
   const server={name:'jira',tools:Object.fromEntries(['getAccessibleAtlassianResources','searchJiraIssuesUsingJql','getJiraIssue','transitionJiraIssue'].map(name=>[name,{name}]))};
   return {data:this.missing?[]:this.ambiguous?[server,{...server,name:'second'}]:[server]};
  }
  if(method==='mcpServer/tool/call'){if(this.fail)throw Error('timeout');return{content:[{type:'text',text:'{"ok":true}'}]};}
  throw Error('Unexpected method '+method);
 }
 notify(){} respond(){} reject(){} close(){this.closed=true;this.emit('disconnect');}
}
test('Codex Jira calls exact MCP tools directly without model turns',async()=>{
 const rpc=new Rpc(),bridge=new CodexJiraTools('C:/Example',async()=>rpc);
 const args={cloudId:'example',issueIdOrKey:'DEMO-1'};
 assert.deepEqual(await bridge.call('getJiraIssue',args),{ok:true});
 await bridge.call('getAccessibleAtlassianResources',{});
 const calls=rpc.calls.filter(x=>x.method==='mcpServer/tool/call');
 assert.deepEqual(calls[0].params,{threadId:'ephemeral-jira',server:'jira',tool:'getJiraIssue',arguments:args});
 assert.equal(rpc.calls.filter(x=>x.method==='thread/start').length,1);
 assert.equal(rpc.calls.some(x=>x.method==='turn/start'),false);
 await assert.rejects(bridge.call('executeRead',{name:'unrelated'}),/Unsupported/);
 bridge.close();assert.equal(rpc.closed,true);
});
test('missing or ambiguous connectors fail without falling back to a model',async()=>{
 for(const mode of ['missing','ambiguous'] as const){const rpc=new Rpc();rpc[mode]=true;const bridge=new CodexJiraTools('C:/Example',async()=>rpc);
 await assert.rejects(bridge.call('getJiraIssue',{}),/Connect Atlassian|Multiple Jira/);assert.equal(rpc.closed,true);assert.equal(rpc.calls.some(x=>x.method==='mcpServer/tool/call'),false);bridge.close();}
});
test('uncertain writes are attempted once only',async()=>{
 const rpc=new Rpc();rpc.fail=true;const bridge=new CodexJiraTools('C:/Example',async()=>rpc);
 await assert.rejects(bridge.call('transitionJiraIssue',{transitionId:'1'}),/timeout/);
 assert.equal(rpc.calls.filter(x=>x.method==='mcpServer/tool/call').length,1);bridge.close();
});
