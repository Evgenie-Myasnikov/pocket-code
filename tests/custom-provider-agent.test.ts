import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CustomProviders,agentBaseUrl} from '../server/custom-providers.js';
import {Jobs} from '../server/jobs.js';

const store=()=>{let stored:any={};return {load:async()=>stored,save:async(value:any)=>{stored=structuredClone(value);}};};

test('the Claude agent base URL drops an OpenAI-style /v1 suffix',()=>{
 assert.equal(agentBaseUrl('https://api.example.com/v1'),'https://api.example.com');
 assert.equal(agentBaseUrl('https://api.example.com/v1/'),'https://api.example.com');
 assert.equal(agentBaseUrl('https://api.example.com/anthropic'),'https://api.example.com/anthropic');
 assert.throws(()=>agentBaseUrl('http://example.com/v1'));
});

for(const header of ['bearer','x-api-key'] as const){
 test(`an Anthropic-compatible provider runs the agent with its own URL, ${header} key and model only`,async()=>{
  const seen:string[]=[];
  const service=new CustomProviders(store(),async(url,options)=>{const h=options?.headers as Record<string,string>;const u=String(url);
   if(u.endsWith('/models'))return Response.json({data:[{id:'synthetic-model'}]});
   seen.push(u);const accepted=header==='bearer'?h.Authorization==='Bearer synthetic-key':h['x-api-key']==='synthetic-key';
   return new Response('{}',{status:accepted?400:401});});
  const {id}=await service.save({name:'Synthetic',url:'https://api.example.com/v1',key:'synthetic-key'});
  const [listed]=await service.list(true);assert.equal(listed.status?.agent,'supported');assert.ok(seen.every(u=>u==='https://api.example.com/v1/messages'));
  const env=await service.agentEnv(id,'synthetic-model',{PATH:'synthetic-path',ANTHROPIC_API_KEY:'host-key',CLAUDE_CODE_OAUTH_TOKEN:'host-token',ANTHROPIC_BASE_URL:'https://host.invalid'});
  assert.equal(env.PATH,'synthetic-path');assert.equal(env.ANTHROPIC_BASE_URL,'https://api.example.com');assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN,undefined);
  if(header==='bearer'){assert.equal(env.ANTHROPIC_AUTH_TOKEN,'synthetic-key');assert.equal(env.ANTHROPIC_API_KEY,undefined);}
  else{assert.equal(env.ANTHROPIC_API_KEY,'synthetic-key');assert.equal(env.ANTHROPIC_AUTH_TOKEN,undefined);}
  for(const name of ['ANTHROPIC_MODEL','ANTHROPIC_SMALL_FAST_MODEL','ANTHROPIC_DEFAULT_OPUS_MODEL','ANTHROPIC_DEFAULT_SONNET_MODEL','ANTHROPIC_DEFAULT_HAIKU_MODEL','CLAUDE_CODE_SUBAGENT_MODEL'])assert.equal(env[name],'synthetic-model');
  assert.equal(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC,'1');
  assert.equal('agentAuth' in listed,false);assert.equal('key' in listed,false);
 });
}

test('providers without an Anthropic API or key cannot start the agent',async()=>{
 const service=new CustomProviders(store(),async url=>String(url).endsWith('/models')?Response.json({data:[{id:'m'}]}):new Response('{}',{status:404}));
 const {id}=await service.save({name:'OpenAI only',url:'https://api.example.com/v1',key:'synthetic-key'});
 assert.equal((await service.list(true))[0].status?.agent,'unsupported');
 const {id:empty}=await service.save({name:'No key',url:'https://api.example.com/v1'});
 await assert.rejects(service.agentEnv(empty,'m'),/API key/);
 assert.ok(await service.agentEnv(id,'m'));
});

test('a Claude task passes the custom provider environment to the agent and reports its account',async()=>{
 let options:any;
 const run=((input:{options:any})=>{options=input.options;return (async function*(){yield {type:'result',subtype:'success',session_id:'00000000-0000-4000-8000-000000000001',result:'done',is_error:false} as any;})();}) as any;
 const jobs=new Jobs(run);
 const view=jobs.start({id:'00000000-0000-4000-8000-000000000002',cwd:process.cwd(),text:'Hello',model:'synthetic-model',mode:'default',maxBudgetUsd:1,env:{ANTHROPIC_BASE_URL:'https://api.example.com',PATH:'synthetic'},account:'00000000-0000-4000-8000-000000000003'});
 assert.equal(view.account,'00000000-0000-4000-8000-000000000003');
 for(let i=0;i<50&&!options;i++)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(options.env.ANTHROPIC_BASE_URL,'https://api.example.com');assert.equal(options.model,'synthetic-model');
 const plain=new Jobs(run);options=undefined;plain.start({id:'00000000-0000-4000-8000-000000000004',cwd:process.cwd(),text:'Hello',mode:'default',maxBudgetUsd:1});
 for(let i=0;i<50&&!options;i++)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal('env' in options,false);
});

test('a custom provider task announces its session with the account, and the chat library keeps it',async()=>{
 const {ChatLibrary}=await import('../server/chat-library.js');
 const {mkdtemp,rm}=await import('node:fs/promises');const os=await import('node:os');const path=await import('node:path');
 const dir=await mkdtemp(path.join(os.tmpdir(),'pocket-chat-library-'));
 try{
  const library=new ChatLibrary(path.join(dir,'.chat-library.json'));
  const session='00000000-0000-4000-8000-000000000011',account='00000000-0000-4000-8000-000000000013';
  const run=(()=>(async function*(){yield {type:'system',subtype:'init',session_id:session} as any;yield {type:'result',subtype:'success',session_id:session,result:'done',is_error:false} as any;})()) as any;
  const jobs=new Jobs(run),seen:{sessionId:string;account?:string}[]=[];
  jobs.onSession(job=>{seen.push(job);if(job.account)void library.tagAccount(job.sessionId,job.account);});
  jobs.start({id:'00000000-0000-4000-8000-000000000012',cwd:process.cwd(),text:'Hello',model:'m',mode:'default',maxBudgetUsd:1,account});
  for(let i=0;i<50&&!seen.length;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.deepEqual(seen,[{sessionId:session,account}]);
  await library.tagAccount(session,account);
  const [listed]=await library.decorate('claude',[{sessionId:session}]);
  assert.equal((listed as {account?:string}).account,account);
  const plain=new Jobs(run),plainSeen:unknown[]=[];plain.onSession(job=>plainSeen.push(job));
  plain.start({id:'00000000-0000-4000-8000-000000000014',cwd:process.cwd(),text:'Hello',mode:'default',maxBudgetUsd:1});
  for(let i=0;i<50&&!plainSeen.length;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.deepEqual(plainSeen,[{sessionId:session}]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
