// Keep decoding and authenticated preview reads bounded. Off-screen/cancelled
// tasks never start; in-flight native requests finish without retaining results.
export function thumbnailQueue(concurrency=2){
  type Task={active:boolean;load:()=>Promise<Blob>;done:(url:string|null)=>void};
  const pending:Task[]=[];let running=0,disposed=false;
  async function run(task:Task){
    let bitmap:ImageBitmap|undefined,url:string|null=null;
    try{
      const blob=await task.load();if(disposed||!task.active)return;
      bitmap=await createImageBitmap(blob,{resizeWidth:256,resizeQuality:'medium'});
      if(disposed||!task.active)return;
      const ratio=Math.min(1,256/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
      canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const thumbnail=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.8));
      if(thumbnail&&task.active&&!disposed)url=URL.createObjectURL(thumbnail);
    }catch{/* A thumbnail failure keeps the image card available for explicit full preview. */}
    finally{
      bitmap?.close();
      if(task.active&&!disposed)task.done(url);else if(url)URL.revokeObjectURL(url);
      running--;pump();
    }
  }
  function pump(){while(!disposed&&running<concurrency&&pending.length){const task=pending.shift()!;if(!task.active)continue;running++;void run(task);}}
  return {
    enqueue(load:()=>Promise<Blob>,done:(url:string|null)=>void){const task={active:true,load,done};pending.push(task);pump();return()=>{task.active=false;};},
    dispose(){disposed=true;pending.length=0;},
  };
}
export type ThumbnailQueue=ReturnType<typeof thumbnailQueue>;
export function imageBlob(source:string):Blob{
  const match=/^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/\r\n]*={0,2})$/.exec(source);
  if(!match)throw Error('Unsupported image preview');
  const binary=atob(match[2]),bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
  return new Blob([bytes],{type:match[1]});
}
