// Keep the provider transport alive while replacing only an idle board worker.
export class BoardMcpProxy{
 constructor(start,onChanged=()=>{}){this.start=start;this.onChanged=onChanged;this.active=0;this.closed=false;}
 async refresh(spec){
  if(this.closed)throw Error('Board MCP closed');
  if(this.spec===spec&&this.client)return;
  this.requested=spec;
  if(this.rotation)return this.rotation;
  const rotate=async()=>{
   while(!this.closed&&this.requested!==this.spec){
    if(this.active)await new Promise(resolve=>{this.idle=resolve;});
    if(this.closed)return;
    const wanted=this.requested,next=await this.start(wanted);
    if(this.closed){await next.close();return;}
    const previous=this.client;this.client=next;this.spec=wanted;
    await previous?.close().catch(()=>{});if(previous)this.onChanged();
   }
  };
  this.rotation=rotate();try{await this.rotation;}finally{this.rotation=undefined;}
 }
 async call(method,params){
  // An uncertain write is never retried against a replacement process.
  if(this.rotation)await this.rotation;
  if(this.closed||!this.client)throw Error('Board MCP unavailable');
  this.active++;
  try{return await this.client[method](params);}finally{if(--this.active===0){this.idle?.();this.idle=undefined;}}
 }
 async close(){this.closed=true;this.idle?.();await this.rotation?.catch(()=>{});await this.client?.close().catch(()=>{});}
}
