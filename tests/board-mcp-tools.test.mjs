import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

const context={summary:'Synthetic creation rationale',sources:['docs/BOARD-MCP.md']};
const json=result=>JSON.parse(result.content[0].text);

test('board MCP creates, connects, diagrams, filters and reports structured errors',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'board-mcp-tools-')),token=randomUUID();
 await writeFile(path.join(root,'connection-key.txt'),token);
 const frame={id:randomUUID(),kind:'frame',text:'Synthetic section',x:0,y:0,width:1000,height:800,color:'sand'};
 const inFrame={id:randomUUID(),kind:'sticky',text:'Inside idea',x:100,y:200,width:240,height:180,color:'mint'};
 const outside={id:randomUUID(),kind:'text',text:'Outside idea',x:3000,y:3000,width:240,height:120,color:'sand'};
 let version='0.28.33',revisionIndex=0;
 const revision=()=>String(revisionIndex).repeat(64).slice(0,64);
 let board={repositoryFile:'board-'+randomUUID()+'.json',name:'Synthetic board',repositoryRevision:revision(),versions:['Next'],
  notes:[{id:randomUUID(),title:'Ready task',description:'Synthetic',branch:'Next',status:'ready',priority:'normal',x:5000,y:5000,dependencies:[],owner:'',assigneeIds:[]},{id:randomUUID(),title:'Idea task',description:'Synthetic',branch:'Next',status:'idea',priority:'normal',x:5400,y:5000,dependencies:[],owner:'',assigneeIds:[]}],
  canvas:{version:1,items:[frame,inFrame,outside],links:[]}};
 const host=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401);res.end('{}');return;}
  if(req.url==='/api/health'){res.end(JSON.stringify({version}));return;}
  if(req.method==='GET'){res.end(JSON.stringify({board}));return;}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const data=JSON.parse(Buffer.concat(chunks));
  if(req.url==='/api/project-board/activity'){res.end('{}');return;}
  if(data.repositoryRevision!==board.repositoryRevision){res.writeHead(409);res.end('{}');return;}
  revisionIndex++;board={...board,...data,repositoryRevision:revision()};res.end(JSON.stringify(board));
 });
 await new Promise(resolve=>host.listen(0,'127.0.0.1',resolve));
 const transport=new StdioClientTransport({command:process.execPath,args:['scripts/board-mcp.mjs','demo='+root],env:{...process.env,POCKET_PORT:String(host.address().port),POCKET_DATA_DIR:root},stderr:'pipe'});
 const client=new Client({name:'synthetic-test',version:'1.0.0'});
 try{
  await client.connect(transport);
  const invoke=(name,args)=>client.callTool({name,arguments:{project:'demo',...args}});
  const tools=(await client.listTools()).tools.map(t=>t.name);
  for(const name of ['canvas_create','canvas_connect','board_create_diagram'])assert.ok(tools.includes(name),name);

  // Filters and paging.
  const missing=await invoke('search_board',{});assert.ok(missing.isError);assert.equal(json(missing).error.code,'invalid_input');
  assert.deepEqual(json(await invoke('search_board',{frameId:frame.id})).matches.map(m=>m.id),[inFrame.id]);
  assert.deepEqual(json(await invoke('search_board',{status:'ready'})).matches.map(m=>m.id),[board.notes[0].id]);
  assert.deepEqual(json(await invoke('search_board',{kinds:['text']})).matches.map(m=>m.id),[outside.id]);
  assert.deepEqual(json(await invoke('search_board',{area:{x:2900,y:2900,width:600,height:600}})).matches.map(m=>m.id),[outside.id]);
  const first=json(await invoke('search_board',{query:'idea',limit:1}));assert.equal(first.total,3);assert.equal(first.matches.length,1);assert.equal(first.next,1);
  const last=json(await invoke('search_board',{query:'idea',limit:2,cursor:2}));assert.equal(last.matches.length,1);assert.equal(last.next,null);
  const paged=json(await invoke('read_board',{limit:3}));assert.equal(paged.notes.length,2);assert.equal(paged.canvas.items.length,1);assert.equal(paged.page.next,3);assert.equal(paged.page.total,5);
  const unknownFrame=await invoke('search_board',{frameId:randomUUID()});assert.equal(json(unknownFrame).error.code,'not_found');

  // canvas_create issues IDs, resolves refs and keeps connection labels.
  const created=json(await invoke('canvas_create',{revision:board.repositoryRevision,context,items:[{ref:'a',kind:'sticky',text:'Step A',x:2000,y:100,width:240,height:140,color:'blue'},{ref:'b',kind:'sticky',text:'Step B',x:2400,y:100,width:240,height:140,color:'blue'}],links:[{ref:'ab',from:'a',to:'b',label:'then',style:'dashed'},{from:'b',to:inFrame.id}]}));
  const a=created.created.objects.a,b=created.created.objects.b;
  assert.match(a,/^[0-9a-f-]{36}$/);assert.notEqual(a,b);
  const saved=board.canvas.links.find(l=>l.id===created.created.connections.ab);assert.deepEqual({from:saved.from,to:saved.to,label:saved.label,style:saved.style},{from:a,to:b,label:'then',style:'dashed'});
  assert.ok(board.canvas.links.some(l=>l.from===b&&l.to===inFrame.id));
  assert.match(board.canvas.items.find(i=>i.id===a).description,/Creation context/);
  assert.equal(json(await invoke('canvas_create',{revision:board.repositoryRevision,context,items:[{ref:'x',kind:'text',text:'X',x:0,y:0,width:240,height:120,color:'sand'}],links:[{from:'x',to:'nowhere'}]})).error.code,'not_found');

  // canvas_connect between existing objects; labels need a current host.
  const connected=json(await invoke('canvas_connect',{revision:board.repositoryRevision,links:[{from:inFrame.id,to:outside.id,style:'line'}]}));
  assert.equal(board.canvas.links.find(l=>l.id===connected.created.ids[0]).style,'line');
  version='0.28.32';const old=await invoke('canvas_connect',{revision:board.repositoryRevision,links:[{from:outside.id,to:inFrame.id,label:'needs new host'}]});assert.equal(json(old).error.code,'host_too_old');version='0.28.33';

  // Structured conflict reports the current revision.
  const stale=await invoke('canvas_connect',{revision:'f'.repeat(64),links:[{from:inFrame.id,to:outside.id}]});
  const error=json(stale).error;assert.equal(error.code,'revision_conflict');assert.equal(error.retryable,true);assert.equal(error.currentRevision,board.repositoryRevision);

  // Mermaid diagram: framed stickies, labelled and styled connections, node map.
  const before=board.canvas.items.length;
  const diagram=json(await invoke('board_create_diagram',{revision:board.repositoryRevision,context,title:'Flow',mermaid:'flowchart LR\n A[Start] --> B{Valid?}\n B -->|yes| C((Save))\n B -- no --> D[Fix] -.-> A'}));
  assert.deepEqual(Object.keys(diagram.created.nodes),['A','B','C','D']);assert.equal(board.canvas.items.length,before+5);
  const diagramFrame=board.canvas.items.find(i=>i.id===diagram.created.frame);assert.equal(diagramFrame.kind,'frame');assert.equal(diagramFrame.text,'Flow');
  for(const node of Object.values(diagram.created.nodes)){const item=board.canvas.items.find(i=>i.id===node);assert.ok(item.x>=diagramFrame.x&&item.x+item.width<=diagramFrame.x+diagramFrame.width&&item.y+item.height<=diagramFrame.y+diagramFrame.height);}
  const yes=board.canvas.links.find(l=>l.label==='yes');assert.equal(yes.from,diagram.created.nodes.B);assert.equal(yes.fromSide,'e');
  assert.ok(board.canvas.links.some(l=>l.from===diagram.created.nodes.D&&l.to===diagram.created.nodes.A&&l.style==='dashed'));
  assert.equal(json(await invoke('board_create_diagram',{revision:board.repositoryRevision,context,mermaid:'sequenceDiagram\n A->>B: hi'})).error.code,'invalid_diagram');
 }finally{await client.close();await new Promise(resolve=>host.close(resolve));await rm(root,{recursive:true,force:true});}
});
