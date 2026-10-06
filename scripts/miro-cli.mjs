// Local AI helper: host credentials remain in this process, never in arguments or output.
import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
const [action,root,argument]=process.argv.slice(2);
try{
 if(!['status','read','update'].includes(action)||!root)throw Error('Usage: miro-cli.mjs status <project-root> | read <project-root> [cursor] | update <project-root> <json-file>');
 const port=Number(process.env.POCKET_PORT||4318);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid local port.');
 const token=(await readFile(path.join(process.env.POCKET_DATA_DIR||path.join(homedir(),'.pocket-code'),'connection-key.txt'),'utf8')).trim();
 let endpoint='/miro/'+(action==='read'?'items':action)+'?root='+encodeURIComponent(root),body;
 if(action==='read'&&argument)endpoint+='&cursor='+encodeURIComponent(argument);
 if(action==='update'){if(!argument)throw Error('An update JSON file is required. Read the item first and retain its revision.');const raw=await readFile(argument);if(raw.length>50000)throw Error('Update file is too large.');const value=JSON.parse(raw.toString('utf8'));if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(key=>!['itemId','revision','content','title'].includes(key)))throw Error('Update accepts itemId, revision, plain-text content and optional card title.');body={...value,root};endpoint='/miro/items/update';}
 const response=await fetch('http://127.0.0.1:'+port+'/api'+endpoint,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('Miro request failed ('+response.status+'). Check host settings and board access; read again before retrying an edit.');
 console.log(JSON.stringify(await response.json(),null,2));
}catch(error){console.error(error.code==='ENOENT'?'Local host configuration or input file was not found.':error instanceof SyntaxError?'The update file is not valid JSON.':error instanceof Error?error.message:'Miro request failed.');process.exitCode=1;}
