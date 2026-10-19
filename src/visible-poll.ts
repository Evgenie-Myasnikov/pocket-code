type VisibilitySource=Pick<Document,'visibilityState'|'addEventListener'|'removeEventListener'>;

// UI polling pauses while Android/WebView is hidden. The host keeps running;
// returning to the app fetches its latest snapshot without overlapping requests.
// A gate (the connection supervisor) pauses the work while the PC is away; its "recovered" event runs every gated poll at once.
export function startVisiblePoll(task:()=>Promise<void|boolean>,interval:number,immediate=true,source:VisibilitySource=document,gate?:()=>boolean){
  let stopped=false,inFlight=false,timer:ReturnType<typeof setTimeout>|undefined;
  const clear=()=>{clearTimeout(timer);timer=undefined;};
  const stop=()=>{stopped=true;clear();source.removeEventListener('visibilitychange',visibility);if(gate&&typeof window!=='undefined')window.removeEventListener('pocket-recovered',recovered);};
  const schedule=()=>{if(!stopped&&source.visibilityState!=='hidden')timer=setTimeout(run,interval);};
  async function run(){
    clear();
    if(stopped||inFlight||source.visibilityState==='hidden')return;
    if(gate&&!gate()){schedule();return;}
    inFlight=true;
    try{if(await task()===false)stop();}
    catch{/* The caller owns error presentation; later polls can recover. */}
    finally{inFlight=false;schedule();}
  }
  function visibility(){clear();if(source.visibilityState!=='hidden')void run();}
  function recovered(){if(!inFlight){clear();void run();}}
  source.addEventListener('visibilitychange',visibility);
  if(gate&&typeof window!=='undefined')window.addEventListener('pocket-recovered',recovered);
  if(immediate)void run();else schedule();
  return stop;
}
