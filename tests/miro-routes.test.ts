import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {MiroIntegration} from '../server/miro-integration';
import {mountMiro} from '../server/miro-routes';
import {z} from 'zod';

test('Miro routes enforce host actions, roots, linked board ownership and callback origin',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'pocket-miro-')),root=path.join(temp,'project');await mkdir(root);
 let stored:any={},calls=0;const integration=new MiroIntegration({load:async()=>stored,save:async value=>{stored=value;}},(async()=>{calls++;return Response.json({id:'synthetic_board'});}) as typeof fetch);
 const app=express();app.use('/api',(req,res,next)=>{if(!req.headers.authorization){res.sendStatus(401);return;}res.locals.deviceAdmin=req.headers.authorization==='Bearer synthetic-host';next();});app.use(express.json());
 const access={current:()=>undefined,store:{snapshot:()=>({miroBoards:[{root,url:'https://miro.com/app/board/synthetic_board/'}]})}};
 mountMiro(app,{integration,roots:[root],access:access as any});app.use((error:any,_req:any,res:any,_next:any)=>res.status(error instanceof z.ZodError?400:error.status||500).json({error:error.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const url='http://127.0.0.1:'+(server.address() as any).port;
 const call=(route:string,body?:unknown,identity='synthetic-host')=>fetch(url+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+identity,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await fetch(url+'/api/miro/status')).status,401);
  assert.equal((await call('/api/miro/token',{root,token:'synthetic-token'},'synthetic-mobile')).status,403);
  const mobile=await call('/api/miro/status?root='+encodeURIComponent(root),undefined,'synthetic-mobile');assert.equal((await mobile.json()).canManage,false);
  assert.equal((await call('/api/miro/token',{root:temp,token:'synthetic-token'})).status,403);assert.equal(calls,0);
  assert.equal((await call('/api/miro/token',{root,token:'synthetic-token'})).status,200);
  assert.equal((await call('/api/miro/items?root='+encodeURIComponent(root))).status,403);
  assert.equal((await call('/api/miro/config',{clientId:'synthetic-client',clientSecret:'synthetic-secret'})).status,200);
  const login=await (await call('/api/miro/oauth/start',{})).json();assert.equal(login.redirectUri,url+'/miro/oauth/callback');
  const state=new URL(login.url).searchParams.get('state'),callback='/miro/oauth/callback?state='+state+'&code=synthetic-code';
  const forged=await fetch(url+callback,{headers:{'X-Forwarded-For':'203.0.113.1'}});assert.equal(forged.status,400);assert.equal(forged.headers.get('cache-control'),'no-store');assert.equal((await forged.text()).includes('synthetic-code'),false);
  assert.equal((await fetch(url+'/miro/oauth/callback?state=wrong&code=synthetic-code')).status,400);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(temp,{recursive:true,force:true});}
});
