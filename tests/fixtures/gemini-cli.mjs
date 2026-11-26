// A stand-in for Gemini CLI in tests: the stream-json events and the JSONL history of the real CLI, with synthetic text.
import {appendFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

const args=process.argv.slice(2),home=process.env.GEMINI_CLI_HOME||'.',value=name=>{const at=args.indexOf(name);return at>=0?args[at+1]:undefined;};
appendFileSync(path.join(home,'gemini-args.log'),JSON.stringify({args,cwd:process.cwd(),apiKey:Boolean(process.env.GEMINI_API_KEY)})+'\n');
if(args.includes('--version')){console.log('0.71.1');process.exit(0);}
if(args.includes('--list-models')){console.log(JSON.stringify([{id:'gemini-3-pro-preview',name:'Gemini 3 Pro',description:'Synthetic pro model'},{id:'gemini-2.5-flash',name:'Gemini 2.5 Flash'}]));process.exit(0);}

let prompt='';process.stdin.setEncoding('utf8');for await(const chunk of process.stdin)prompt+=chunk;
const resume=value('--resume'),sessionId=resume||value('--session-id')||randomUUID(),cwd=process.cwd();
const dir=path.join(home,'.gemini','tmp','fixture-project'),chats=path.join(dir,'chats'),file=path.join(chats,`session-${sessionId}.jsonl`);
mkdirSync(chats,{recursive:true});writeFileSync(path.join(dir,'.project_root'),cwd);
if(resume&&!existsSync(file)){console.error('Invalid session identifier');process.exit(1);}
if(!existsSync(file))appendFileSync(file,JSON.stringify({sessionId,projectHash:createHash('sha256').update(cwd).digest('hex'),startTime:new Date().toISOString(),kind:'main'})+'\n');
const emit=event=>process.stdout.write(JSON.stringify({timestamp:new Date().toISOString(),...event})+'\n');
const record=item=>appendFileSync(file,JSON.stringify({timestamp:new Date().toISOString(),...item})+'\n');
const userId=randomUUID(),replyId=randomUUID(),toolId='tool-'+userId.slice(0,8),reply=prompt.includes('second')?'Second answer':'Hello from Gemini';
record({id:userId,type:'user',content:[{text:prompt}]});
emit({type:'init',session_id:sessionId,model:value('--model')||'auto'});
emit({type:'message',role:'user',content:prompt});
if(prompt.includes('FAIL')){emit({type:'error',severity:'error',message:'Synthetic failure'});process.exit(1);}
if(prompt.includes('SLOW'))await new Promise(resolve=>setTimeout(resolve,1500));
emit({type:'tool_use',tool_name:'read_file',tool_id:toolId,parameters:{file_path:'README.md'}});
emit({type:'tool_result',tool_id:toolId,status:'success',output:'Synthetic file text'});
for(const part of reply.split(/(?<= )/))emit({type:'message',role:'assistant',content:part,delta:true});
record({id:replyId,type:'gemini',content:'',thoughts:[{subject:'Reading',description:'Looking at the file'}],toolCalls:[{id:toolId,name:'read_file',args:{file_path:'README.md'},status:'success',resultDisplay:'Synthetic file text'}]});
record({id:replyId,type:'gemini',content:reply,thoughts:[{subject:'Reading',description:'Looking at the file'}],toolCalls:[{id:toolId,name:'read_file',args:{file_path:'README.md'},status:'success',resultDisplay:'Synthetic file text'}]});
emit({type:'result',status:'success',stats:{total_tokens:120,input_tokens:100,output_tokens:20,cached:0,input:100,duration_ms:2000,tool_calls:1,models:{}}});
