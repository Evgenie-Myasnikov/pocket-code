import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {BoardViewControl,type BoardViewState} from '../server/board-view-control';
const state=():BoardViewState=>({revision:'a'.repeat(64),visible:true,busy:false,following:true,zoom:1,pan:{x:40,y:40},width:800,height:600,selected:[],inView:[]});
test('commands target one view and require an applied state, with idempotent request IDs',async()=>{
 const c=new BoardViewControl(100),a=randomUUID(),b=randomUUID(),id=randomUUID(),s=state();c.report('board',a,1,s);c.report('board',b,1,s);
 const result=c.execute('board',a,id,s.revision,{type:'follow',enabled:false});assert.equal(c.report('board',b,2,s).command,null);assert.equal(c.report('other',a,1,s).command,null);
 assert.equal(c.report('board',a,2,s).command?.id,id);
 c.report('board',a,3,{...s,following:false},{id,status:'applied'});assert.equal((await result).status,'applied');
 assert.deepEqual(await c.execute('board',a,id,s.revision,{type:'follow',enabled:false}),await result);assert.equal(c.report('board',a,4,s).command,null);
 assert.throws(()=>c.execute('board',a,id,s.revision,{type:'follow',enabled:true}),/different input/);
 const bad=randomUUID(),rejected=c.execute('board',a,bad,s.revision,{type:'follow',enabled:false});c.report('board',a,5,s,{id:bad,status:'applied'});assert.equal((await rejected).status,'rejected');
});
test('expired, hidden, busy and stale views cannot claim command success or replay after reopening',async()=>{
 let now=100;const c=new BoardViewControl(20,()=>now),view=randomUUID(),s=state();c.report('a',view,1,s);
 const id=randomUUID(),pending=c.execute('a',view,id,s.revision,{type:'fit'});assert.equal((await pending).status,'unconfirmed');assert.equal(c.report('a',view,2,s).command,null);
 assert.equal((await c.execute('a',view,id,s.revision,{type:'fit'})).status,'unconfirmed');
 c.report('a',view,3,{...s,busy:true});assert.throws(()=>c.execute('a',view,randomUUID(),s.revision,{type:'fit'}),/busy/);
 c.report('a',view,4,{...s,visible:false});assert.throws(()=>c.execute('a',view,randomUUID(),s.revision,{type:'fit'}),/hidden/);
 c.report('a',view,5,s);assert.throws(()=>c.execute('a',view,randomUUID(),'b'.repeat(64),{type:'fit'}),/stale/);
 const next=c.execute('a',view,randomUUID(),s.revision,{type:'fit'});c.report('a',view,6,null);assert.equal((await next).status,'unavailable');
 c.report('a',view,5,s);assert.equal(c.list('a').length,0);c.report('a',view,7,s);now+=4001;assert.equal(c.list('a').length,0);
});
