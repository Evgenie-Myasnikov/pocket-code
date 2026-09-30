import test from 'node:test';
import assert from 'node:assert/strict';
import {extractChatOutputs,outputReference} from '../src/chat-outputs.js';
import type {Block,ChatMessage} from '../server/types.js';
const message=(id:string,blocks:Block[],role:ChatMessage['role']='assistant'):ChatMessage=>({id,role,blocks});

test('results index separates user attachments from images returned in user-role tool results',()=>{
  const outputs=extractChatOutputs([
    message('input',[{type:'image',title:'Reference image',source:{type:'base64',media_type:'image/png',data:'AAAA'}}],'user'),
    message('result',[{type:'tool_result',content:[{type:'image',title:'Generated image',mimeType:'image/png',data:'BBBB'}]}],'user'),
  ]);
  assert.equal(outputs.find(item=>item.title==='Reference image')?.source,'sources');
  assert.equal(outputs.find(item=>item.title==='Generated image')?.source,'results');
  assert.equal(outputs.filter(item=>item.category==='images').length,2);
});

test('markdown links, reference links and fences create inspectable categories without parsing code as links',()=>{
  const outputs=extractChatOutputs([message('md',[{type:'text',text:'[Report](docs/report.md)\n![Chart](<artifacts/a chart.png>)\n[Spec][guide]\n[guide]: https://example.test/manual.pdf\n```ts\nconst url = "https://do-not-index.test";\n```\nhttps://example.test/page'}])]);
  assert.equal(outputs.filter(item=>item.category==='documents').length,2);
  assert.equal(outputs.find(item=>item.category==='images')?.path,'artifacts/a chart.png');
  assert.equal(outputs.find(item=>item.category==='code')?.text,'const url = "https://do-not-index.test";');
  assert.equal(outputs.filter(item=>item.category==='links').length,1);
  assert.ok(!outputs.some(item=>item.href?.includes('do-not-index')));
});

test('local code links retain paths and strip optional line locations; unsupported protocols are excluded',()=>{
  assert.deepEqual(outputReference('C:\\Project\\src\\app.ts:27:4'),{path:'C:\\Project\\src\\app.ts'});
  assert.deepEqual(outputReference('/project/src/app.ts#L27'),{path:'/project/src/app.ts'});
  for(const value of ['javascript:alert(1)','data:image/svg+xml,hi','mcp://resource/secret','file:///etc/passwd','//remote.test/a.png','\\\\server\\share\\x.md','https://name:password@example.test/a','bad\nfile.md'])assert.equal(outputReference(value),null,value);
});

test('tool file changes preserve their saved diff separately from the current file path',()=>{
  const outputs=extractChatOutputs([message('change',[{type:'tool_use',name:'File changes',input:{changes:[{path:'src/main.ts',diff:'-old\n+new'}]}}])]);
  const file=outputs.find(item=>item.category==='code');
  assert.equal(file?.path,'src/main.ts');assert.equal(file?.text,'-old\n+new');assert.equal(file?.language,'diff');
});

test('MCP resources and Codex-wrapped resource links are indexed and duplicate references are merged',()=>{
  const outputs=extractChatOutputs([message('resource',[
    {type:'codexContent',content:{type:'resource_link',name:'Guide',uri:'https://example.test/guide.pdf',mimeType:'application/pdf'}},
    {type:'codexContent',content:{type:'resource',resource:{uri:'memory://note',mimeType:'text/markdown',text:'# Note'}}},
    {type:'text',text:'[Same guide](https://example.test/guide.pdf)'},
  ])]);
  assert.equal(outputs.length,2);assert.equal(outputs.find(item=>item.text)?.language,'markdown');
});

test('bounded indexing ignores system/private thinking and excessive nested tool structures',()=>{
  let nested:Block={type:'image',title:'Too deep',source:{data:'AAAA',media_type:'image/png'}};
  for(let i=0;i<12;i++)nested={type:'tool_result',content:[nested]};
  const outputs=extractChatOutputs([message('system',[{type:'text',text:'[secret](secret.md)'}],'system'),message('thought',[{type:'thinking',thinking:'[secret](secret.md)'},nested])]);
  assert.ok(!outputs.some(item=>item.category==='images'||item.path));
  assert.ok(outputs.length<12);
});

test('newest outputs appear first and repeated file paths use the latest saved diff',()=>{
  const outputs=extractChatOutputs([
    message('old',[{type:'tool_use',name:'File changes',input:{changes:[{path:'src/main.ts',diff:'old diff'}]}}]),
    message('new',[{type:'tool_use',name:'File changes',input:{changes:[{path:'src/main.ts',diff:'new diff'}]}},{type:'image',title:'Latest image',source:{media_type:'image/png',data:'AAAA'}}]),
  ]);
  assert.equal(outputs[0].title,'Latest image');assert.equal(outputs.find(item=>item.path)?.text,'new diff');assert.equal(outputs.filter(item=>item.path).length,1);assert.ok(outputs.every(item=>item.category!=='tools'));
});

test('malformed URL percent escapes never crash the index',()=>{
  const outputs=extractChatOutputs([message('link',[{type:'text',text:'https://example.test/%ZZ'}])]);
  assert.equal(outputs.length,1);assert.equal(outputs[0].title,'%ZZ');
});

test('completed Claude Write output becomes a document, while failed writes remain tool errors',()=>{
  const outputs=extractChatOutputs([
    message('calls',[{type:'tool_use',id:'write-ok',name:'Write',input:{file_path:'docs/result.md',content:'# Saved report'}},{type:'tool_use',id:'write-fail',name:'Write',input:{file_path:'docs/failed.md',content:'Not saved'}}]),
    message('results',[{type:'tool_result',tool_use_id:'write-ok',content:'Saved'},{type:'tool_result',tool_use_id:'write-fail',content:'Failed',is_error:true}],'user'),
  ]);
  const file=outputs.find(item=>item.path);assert.equal(file?.path,'docs/result.md');assert.equal(file?.text,'# Saved report');assert.equal(file?.language,'markdown');assert.equal(file?.source,'results');assert.ok(!outputs.some(item=>item.path==='docs/failed.md'));
});

test('malformed long links remain bounded and ordinary parentheses in a URL are preserved',()=>{
  const started=performance.now();
  const outputs=extractChatOutputs([message('large',[{type:'text',text:'[broken]('+ '('.repeat(100_000)+'\n[API](https://example.test/Function(value))'}])]);
  assert.ok(performance.now()-started<1000);assert.equal(outputs[0].href,'https://example.test/Function(value)');
});
