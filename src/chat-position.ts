export type ChatPosition={top:number;window:number;fromStart:boolean;bottom:boolean;messageId?:string;offset?:number;followOnReturn?:boolean};
const prefix='pocket-code-position-v1:';
const memory=new Map<string,ChatPosition>();let timer:ReturnType<typeof setTimeout>|undefined;
const pending=new Map<string,ChatPosition>();
export const positionKey=(scope:string,provider:string,id:string)=>scope?prefix+scope+':'+provider+':'+id:'';
export function readPosition(key:string):ChatPosition|null{if(!key)return null;try{const p=memory.get(key)||JSON.parse(localStorage.getItem(key)||'null');return p&&Number.isFinite(p.top)&&p.top>=0&&Number.isInteger(p.window)&&p.window>=100&&p.window<=5000?p:null;}catch{return null;}}
export function flushPositions(){clearTimeout(timer);for(const [key,value]of pending)try{localStorage.setItem(key,JSON.stringify(value));}catch{}pending.clear();}
export function savePosition(key:string,value:ChatPosition){if(!key)return;memory.set(key,value);pending.set(key,value);if(memory.size>100)memory.delete(memory.keys().next().value!);clearTimeout(timer);timer=setTimeout(flushPositions,250);}
export function markRunningOnLeave(key:string,running:boolean){const position=readPosition(key);if(position||running)savePosition(key,{...(position||{top:0,window:100,fromStart:false,bottom:true}),followOnReturn:running});}
export function positionOnOpen(key:string){const position=readPosition(key);if(!position?.followOnReturn)return position;const latest:ChatPosition={top:0,window:100,fromStart:false,bottom:true};savePosition(key,latest);return latest;}
export function clearPositions(){clearTimeout(timer);memory.clear();pending.clear();try{for(const key of Object.keys(localStorage))if(key.startsWith(prefix))localStorage.removeItem(key);}catch{}}
