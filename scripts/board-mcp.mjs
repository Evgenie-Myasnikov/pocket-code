import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {readFile,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {BoardMcpProxy} from './board-mcp-proxy.mjs';

const args=process.argv.slice(2),roots=[],aliases=new Set();
for(const arg of args){const at=arg.indexOf('='),alias=arg.slice(0,at);if(at<1||! /^[a-z0-9_-]{1,60}$/i.test(alias)||aliases.has(alias))throw Error('Use unique project-alias=absolute-project-root');aliases.add(alias);roots.push(await realpath(arg.slice(at+1)));}
if(!roots.length||roots.length>256)throw Error('Explicit project roots are required');
const port=Number(process.env.POCKET_PORT||4318);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid host port');
const token=(await readFile(path.join(process.env.POCKET_DATA_DIR||path.join(homedir(),'.pocket-code'),'connection-key.txt'),'utf8')).trim();
const server=new Server({name:'pocket-code-boards',version:'2'},{capabilities:{tools:{listChanged:true}}});
const proxy=new BoardMcpProxy(async spec=>{
 const {worker}=JSON.parse(spec),client=new Client({name:'pocket_code_board_proxy',version:'1'});
 const transport=new StdioClientTransport({command:process.execPath,args:[worker,...args],env:process.env,stderr:'pipe'});
 try{await client.connect(transport);transport.stderr?.on('data',()=>{});client.boardTools=(await client.listTools()).tools.map(tool=>tool.name);return client;}catch(error){await client.close().catch(()=>{});throw error;}
},()=>{void server.notification({method:'notifications/tools/list_changed'}).catch(()=>{});});
let stopped=false,polling=false,lastSpec,failedSpec;const instance=randomUUID();
const localWorker=fileURLToPath(new URL('./board-mcp-worker.mjs',import.meta.url));
async function latest(){
 const states=await Promise.all(roots.map(async root=>{
  const response=await fetch(`http://127.0.0.1:${port}/api/project-board/mcp?`+new URLSearchParams({root}),{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Board host unavailable');const state=await response.json();
  if(typeof state.generation!=='string'||!path.isAbsolute(state.worker||'')||path.basename(state.worker)!=='board-mcp-worker.mjs')throw Error('Unsupported board lifecycle');return state;
 }));
 if(states.some(s=>s.worker!==states[0].worker))throw Error('Inconsistent board runtime');
 return JSON.stringify({worker:states[0].worker,generations:states.map(s=>s.generation)});
}
try{lastSpec=await latest();}catch{lastSpec=JSON.stringify({worker:localWorker,generations:[]});}
await proxy.refresh(lastSpec);
server.setRequestHandler(ListToolsRequestSchema,()=>proxy.call('listTools',{}));
server.setRequestHandler(CallToolRequestSchema,request=>proxy.call('callTool',request.params));
await server.connect(new StdioServerTransport());
let reporting=false;
async function report(){if(stopped||reporting)return;reporting=true;try{const spec=JSON.parse(failedSpec||lastSpec);await Promise.all(roots.map(async(root,i)=>{if(!spec.generations[i])return;await fetch(`http://127.0.0.1:${port}/api/project-board/mcp/status`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(3000),body:JSON.stringify({root,instance,generation:spec.generations[i],state:failedSpec?'error':'ready',tools:proxy.client?.boardTools||[]})});}));}catch{/* Optional on older hosts. */}finally{reporting=false;}}
void report();const statusTimer=setInterval(()=>void report(),2000);
const timer=setInterval(async()=>{if(stopped||polling)return;polling=true;try{const spec=await latest();if(spec!==lastSpec){try{await proxy.refresh(spec);lastSpec=spec;failedSpec=undefined;}catch(error){failedSpec=spec;throw error;}void report();}}catch{/* Keep the current worker; retry only discovery, never a tool call. */}finally{polling=false;}},1000);
const close=async()=>{if(stopped)return;stopped=true;clearInterval(timer);clearInterval(statusTimer);await proxy.close();await server.close();};
server.onclose=()=>{void close();};process.stdin.on('end',()=>{void close();});process.on('SIGTERM',()=>{void close();});
