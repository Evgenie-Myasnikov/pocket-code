import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

test('board MCP protects revisions, privacy and old hosts over stdio',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'board-mcp-')),token=randomUUID();
 await writeFile(path.join(root,'connection-key.txt'),token);
 const signals=[];let writes=0,version='0.27.1',board={repositoryFile:'board-'+randomUUID()+'.json',name:'Synthetic board',repositoryRevision:'a'.repeat(64),versions:['Next'],notes:[{id:randomUUID(),title:'Canvas idea',description:'Synthetic example',branch:'Next',status:'idea',priority:'normal',x:0,y:0,dependencies:[],owner:'Private owner',assigneeIds:['private-member']}]};
 const host=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401);res.end('{}');return;}
  if(req.url==='/api/health'){res.end(JSON.stringify({version}));return;}
  if(req.method==='GET'){res.end(JSON.stringify({board}));return;}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const data=JSON.parse(Buffer.concat(chunks));
  if(req.url==='/api/project-board/activity'){signals.push(data);res.end('{}');return;}
  if(data.repositoryRevision!==board.repositoryRevision){res.writeHead(409);res.end('{}');return;}
  writes++;board={...board,...data,repositoryRevision:'b'.repeat(64)};res.end(JSON.stringify(board));
 });
 await new Promise(resolve=>host.listen(0,'127.0.0.1',resolve));
 const transport=new StdioClientTransport({command:process.execPath,args:['scripts/board-mcp.mjs','demo='+root],env:{...process.env,POCKET_PORT:String(host.address().port),POCKET_DATA_DIR:root},stderr:'pipe'});
 const client=new Client({name:'synthetic-test',version:'1.0.0'});
 try{
  await client.connect(transport);
  const invoke=(name,args)=>client.callTool({name,arguments:args});
  const read=await invoke('read_board',{project:'demo'});
  assert.ok(!JSON.stringify(read).includes('Private owner'));assert.ok(!JSON.stringify(read).includes('private-member'));
  assert.ok((await invoke('read_board',{project:'unknown'})).isError);
  const search=JSON.parse((await invoke('search_board',{project:'demo',query:'Canvas'})).content[0].text);assert.equal(search.total,1);
  const context={summary:'Synthetic creation rationale',sources:['docs/BOARD.md'],questions:['Confirm the expected outcome']};
  const item={id:randomUUID(),kind:'sticky',text:'Synthetic sticky',x:0,y:0,width:240,height:180,color:'sand'};
  assert.ok((await invoke('canvas_apply',{project:'demo',revision:'a'.repeat(64),items:[item],context})).isError);assert.equal(writes,0);
  version='0.28.0';assert.ok(!(await invoke('canvas_apply',{project:'demo',revision:'a'.repeat(64),items:[item],context})).isError);assert.equal(writes,1);assert.equal(board.canvas.items[0].id,item.id);
  assert.ok((await invoke('update_note',{project:'demo',revision:'a'.repeat(64),id:board.notes[0].id,patch:{title:'Stale edit'}})).isError);assert.equal(writes,1);
  const task=board.notes[0];assert.ok(!(await invoke('canvas_apply',{project:'demo',revision:'b'.repeat(64),items:[{...item,id:task.id,kind:'card',text:'Updated task',description:'Updated criteria'}]})).isError);
  assert.equal(board.notes[0].title,'Updated task');assert.equal(board.notes[0].description,'Updated criteria');assert.equal(board.notes[0].priority,task.priority);assert.deepEqual(signals.slice(-2).map(s=>s.phase),['editing','saved']);assert.deepEqual(signals.at(-1).ids,[task.id]);
  const free={id:randomUUID(),from:item.id,fromSide:'e',toPoint:{x:800,y:600}};assert.ok((await invoke('canvas_apply',{project:'demo',revision:'b'.repeat(64),items:[],links:[free]})).isError);
  version='0.28.4';assert.ok(!(await invoke('canvas_apply',{project:'demo',revision:'b'.repeat(64),items:[],links:[free]})).isError);assert.deepEqual(board.canvas.links,[free]);
  const newNote={title:'Context-aware task',description:'Product acceptance',branch:'Next',status:'questions',priority:'normal',x:40,y:80,dependencies:[task.id]};
  const before=writes;assert.ok((await invoke('create_note',{project:'demo',revision:'b'.repeat(64),note:newNote})).isError);assert.equal(writes,before);
  assert.ok(!(await invoke('create_note',{project:'demo',revision:'b'.repeat(64),note:newNote,context})).isError);
  const created=board.notes.find(n=>n.title===newNote.title);assert.match(created.description,/Creation context/);assert.match(created.description,/docs\/BOARD.md/);
  const details=JSON.parse((await invoke('read_note_context',{project:'demo',id:created.id})).content[0].text);assert.equal(details.note.id,created.id);assert.equal(details.dependencies[0].id,task.id);assert.ok(!JSON.stringify(details).includes('Private owner'));assert.ok(!JSON.stringify(details).includes('private-member'));

 }finally{await client.close();await new Promise(resolve=>host.close(resolve));await rm(root,{recursive:true,force:true});}
});
