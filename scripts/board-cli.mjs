// Local host helper. Credentials are read only in this process and never printed.
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const [action,boardId,noteId,revision,people,message='',requestId=randomUUID()]=process.argv.slice(2);
const validId=value=>/^[a-f0-9-]{36}$/.test(value||'');
try{
 if(!['list','read','assign','question'].includes(action)||action!=='list'&&!validId(boardId))throw Error('Usage: board-cli.mjs list | read <board-id> | assign/question <board-id> <note-id> <revision> <comma-separated-member-ids> [message] [request-uuid]');
 const port=Number(process.env.POCKET_PORT||4318);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid local port');
 const token=(await readFile(path.join(process.env.POCKET_DATA_DIR||path.join(homedir(),'.pocket-code'),'connection-key.txt'),'utf8')).trim();
 const call=async(route,body)=>{const response=await fetch('http://127.0.0.1:'+port+'/api'+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Board request failed ('+response.status+'). Check access, revision and host availability.');return response.json();};
 let result;
 if(action==='list'){const catalog=await call('/workspaces');result={boards:catalog.boards.map(({id,name,workspaceId})=>({id,name,workspaceId})),workspaces:catalog.workspaces.map(({id,name,people})=>({id,name,people}))};}
 else if(action==='read')result=await call('/boards/'+boardId);
 else{if(!validId(noteId)||!Number.isInteger(Number(revision))||Number(revision)<0||!people||!validId(requestId))throw Error('Invalid board action arguments');result=await call('/boards/'+boardId+'/attention',{requestId,revision:Number(revision),noteId,kind:action,recipients:people.split(','),message});result={ok:true,boardId:result.id,revision:result.revision,requestId};}
 console.log(JSON.stringify(result,null,2));
}catch(error){console.error(error.code==='ENOENT'?'Local Pocket Code host configuration was not found.':error instanceof Error?error.message:'Board action failed');process.exitCode=1;}
