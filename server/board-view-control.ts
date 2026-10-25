import {z} from 'zod';
import {HttpError} from './security.js';
import {viewCommandApplied} from '../src/board-view-command.js';

const uuid=z.string().uuid(),coordinate=z.number().finite().min(-1060000).max(1060000);
export const boardViewState=z.object({revision:z.string().regex(/^[a-f0-9]{64}$/),visible:z.boolean(),busy:z.boolean(),following:z.boolean(),zoom:z.number().min(.1).max(3),pan:z.object({x:coordinate,y:coordinate}).strict(),width:z.number().min(0).max(100000),height:z.number().min(0).max(100000),selected:z.array(uuid).max(2000),inView:z.array(uuid).max(2000)}).strict();
export const boardViewAction=z.discriminatedUnion('type',[
 z.object({type:z.literal('follow'),enabled:z.boolean()}).strict(),
 z.object({type:z.literal('focus'),ids:z.array(uuid).min(1).max(100)}).strict(),
 z.object({type:z.literal('select'),ids:z.array(uuid).max(100)}).strict(),
 z.object({type:z.literal('camera'),x:z.number().min(0).max(106000),y:z.number().min(0).max(106000),zoom:z.number().min(.1).max(3)}).strict(),
 z.object({type:z.literal('fit')}).strict()
]);
export type BoardViewState=z.infer<typeof boardViewState>;
export type BoardViewAction=z.infer<typeof boardViewAction>;
export type ViewCommand={id:string;revision:string;action:BoardViewAction;expiresAt:number};
export type ViewResult={id:string;status:'applied'|'rejected'|'unconfirmed'|'unavailable';reason?:string;state?:BoardViewState};
type Operation={command:ViewCommand;fingerprint:string;result?:ViewResult;resolve:(result:ViewResult)=>void;promise:Promise<ViewResult>;timer:ReturnType<typeof setTimeout>};
type View={sequence:number;seen:number;state:BoardViewState|null;pending?:Operation;history:Map<string,Operation>};
/** Ephemeral view state, scoped to a board and never persisted in its product file. */
export class BoardViewControl{
 private views=new Map<string,Map<string,View>>();
 constructor(private timeout=5000,private now=Date.now){}
 private finish(view:View,operation:Operation,result:ViewResult){if(operation.result)return;clearTimeout(operation.timer);operation.result=result;if(view.pending===operation)view.pending=undefined;operation.resolve(result);}
 private expire(){for(const [key,views] of this.views){for(const [id,v] of views)if(this.now()-v.seen>4000){if(v.pending)this.finish(v,v.pending,{id:v.pending.command.id,status:'unavailable',reason:'view_disconnected'});views.delete(id);}if(!views.size)this.views.delete(key);}}
 list(key:string){this.expire();return [...(this.views.get(key)||[])].filter(([,v])=>v.state).map(([id,v])=>({id,...v.state!,updatedAt:v.seen}));}
 report(key:string,id:string,sequence:number,state:BoardViewState|null,ack?:{id:string;status:'applied'|'rejected';reason?:string}){
  this.expire();let group=this.views.get(key);if(!group){if(this.views.size>=128)throw new HttpError(429,'Too many open boards');group=new Map();this.views.set(key,group);}
  let view=group.get(id);if(!view){if(group.size>=16)throw new HttpError(429,'Too many board views');view={sequence:-1,seen:this.now(),state:null,history:new Map()};group.set(id,view);}
  if(sequence<=view.sequence)return {command:null};view.sequence=sequence;view.seen=this.now();view.state=state;
  if(ack&&view.pending?.command.id===ack.id){const op=view.pending,valid=ack.status==='applied'&&state&&viewCommandApplied(op.command,state);this.finish(view,op,{id:ack.id,status:valid?'applied':'rejected',reason:valid?undefined:ack.reason||'state_not_applied',...(state?{state}:{})});}
  if(view.pending&&(!state?.visible||state.busy)){const op=view.pending;this.finish(view,op,{id:op.command.id,status:'unavailable',reason:!state?.visible?'view_hidden':'view_busy'});}
  return {command:view.pending?.command||null};
 }
 execute(key:string,viewId:string,id:string,revision:string,action:BoardViewAction){
  this.expire();const view=this.views.get(key)?.get(viewId);if(!view?.state)throw new HttpError(409,'Open the board view first');
  const fingerprint=JSON.stringify({revision,action}),previous=view.history.get(id);
  if(previous){if(previous.fingerprint!==fingerprint)throw new HttpError(409,'Command ID already used with different input');return previous.promise;}
  if(!view.state.visible||view.state.busy)throw new HttpError(409,'Board view is hidden or busy');
  if(view.state.revision!==revision)throw new HttpError(409,'Board view revision is stale');
  if(view.pending)throw new HttpError(409,'Board view has an active command');
  let resolve!:(value:ViewResult)=>void;const promise=new Promise<ViewResult>(r=>{resolve=r;});
  const operation:Operation={command:{id,revision,action,expiresAt:this.now()+this.timeout},fingerprint,promise,resolve,timer:setTimeout(()=>{this.finish(view,operation,{id,status:'unconfirmed',reason:'view_did_not_respond'});},this.timeout)};
  view.pending=operation;view.history.set(id,operation);while(view.history.size>32)view.history.delete(view.history.keys().next().value!);return promise;
 }
}
