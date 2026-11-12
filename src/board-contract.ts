import {z} from 'zod';
import {BOARD_VERSION_LIMIT} from './board-limits';
import {whiteboardSchema,whiteboardChart,CANVAS_KINDS,CANVAS_COLORS} from './whiteboard-model';

/** One contract for the portable snapshot: storage, host APIs, MCP and the tolerant reader share these numbers. */
export const BOARD_LIMITS={title:160,description:20000,descriptionInput:200000,branch:300,caption:160,images:12,dependencies:100,notes:500,items:500,links:1000,itemText:4000,versions:BOARD_VERSION_LIMIT,versionLabel:300,name:160,checklist:50,checklistText:300,statusHistory:50,fileBytes:2_000_000,readBytes:8_000_000,coordinate:20000,canvasCoordinate:100000} as const;
export const NOTE_STATUSES=['idea','questions','ready','working','review','done'] as const;
export const NOTE_PRIORITIES=['critical','high','normal','low'] as const;
export type NoteStatus=typeof NOTE_STATUSES[number];
export type NotePriority=typeof NOTE_PRIORITIES[number];
/** Warn before a record reaches the limit that would make the host refuse a write. */
export const NEAR_LIMIT=.9;

const id=z.string().uuid();
export const boardImagePath=/^project-boards\/assets\/[a-f0-9]{64}\.(png|jpg|webp)$/;
export const boardImage=z.object({path:z.string().regex(boardImagePath),caption:z.string().max(BOARD_LIMITS.caption)}).strict();
export const boardImages=z.array(boardImage).max(BOARD_LIMITS.images).optional();
export const boardChecklist=z.array(z.object({text:z.string().trim().min(1).max(BOARD_LIMITS.checklistText),done:z.boolean()}).strict()).max(BOARD_LIMITS.checklist).optional();
const moment=/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z)?$/;
export const boardStatusHistory=z.array(z.object({status:z.enum(NOTE_STATUSES),at:z.string().regex(moment)}).strict()).max(BOARD_LIMITS.statusHistory).optional();
export const versionBranches=z.record(z.string().min(1).max(BOARD_LIMITS.versionLabel),z.string().min(1).max(BOARD_LIMITS.versionLabel)).refine(v=>Object.keys(v).length<=BOARD_VERSION_LIMIT).optional();
/** Product fields of a card; private host fields (owner, assignees, chat) are added by the host schema. */
export const noteFields={id,images:boardImages,title:z.string().min(1).max(BOARD_LIMITS.title),description:z.string().max(BOARD_LIMITS.description),branch:z.string().max(BOARD_LIMITS.branch),status:z.enum(NOTE_STATUSES),priority:z.enum(NOTE_PRIORITIES),x:z.number().min(0).max(BOARD_LIMITS.coordinate),y:z.number().min(0).max(BOARD_LIMITS.coordinate),dependencies:z.array(id).max(BOARD_LIMITS.dependencies),checklist:boardChecklist,statusHistory:boardStatusHistory};
export const publicNote=z.object(noteFields).strict();
export const boardSnapshot=z.object({canvas:whiteboardSchema.optional(),versionBranches,format:z.literal('pocket-code-board'),version:z.literal(1),name:z.string().min(1).max(BOARD_LIMITS.name),versions:z.array(z.string().min(1).max(BOARD_LIMITS.versionLabel)).max(BOARD_VERSION_LIMIT),notes:z.array(publicNote).max(BOARD_LIMITS.notes)}).strict();
export type BoardSnapshot=z.infer<typeof boardSnapshot>;
export type PublicNote=z.infer<typeof publicNote>;

export type BoardIssue={severity:'error'|'warning';scope:'board'|'note'|'item'|'link';id?:string;title?:string;path:string;field?:string;code:string;limit?:number;actual?:number|string;message:string;fix?:string};
export type MovedText={noteId?:string;title:string;label:string;text:string};
export type BoardInspection={board:BoardSnapshot;issues:BoardIssue[];moved:MovedText[]};
export const boardErrors=(issues:BoardIssue[])=>issues.filter(issue=>issue.severity==='error');

type Raw=Record<string,unknown>;
const isObject=(value:unknown):value is Raw=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const isId=(value:unknown):value is string=>typeof value==='string'&&id.safeParse(value).success;
const count=(value:number)=>value.toLocaleString('en-US');
const short=(value:unknown)=>{const text=typeof value==='string'?value:JSON.stringify(value)??String(value);return text.length>60?text.slice(0,57)+'…':text;};
const statusSynonyms:Record<string,NoteStatus>={todo:'ready',backlog:'idea',new:'idea',open:'idea',planned:'ready',blocked:'questions',question:'questions',clarify:'questions','in-progress':'working',in_progress:'working',inprogress:'working',doing:'working',wip:'working',active:'working','in-review':'review',in_review:'review',testing:'review',qa:'review',completed:'done',complete:'done',closed:'done',finished:'done',resolved:'done'};
const prioritySynonyms:Record<string,NotePriority>={medium:'normal',mid:'normal',default:'normal',moderate:'normal',urgent:'critical',blocker:'critical',highest:'critical',p0:'critical',p1:'high',major:'high',p2:'normal',minor:'low',lowest:'low',p3:'low',trivial:'low'};

/**
 * Keeps the task statement (first paragraphs), pinned context blocks and the newest paragraphs in the card
 * and returns the older middle word for word, so the host can append it to the card's history file.
 */
export function archiveDescription(text:string,pointer:string,limit:number=BOARD_LIMITS.description,target=Math.floor(limit*.75)){
 if(text.length<=limit)return {kept:text,moved:''};
 const blocks=text.split(/\n[ \t]*\n/),pinned=/^(Creation context|Sources|Open questions|Контекст создания|Источники|Открытые вопросы):/;
 const head:string[]=[],tail:string[]=[];let used=pointer.length+4,start=0;
 while(start<blocks.length&&(start===0||used+blocks[start].length+2<=Math.min(2000,target/4))){if(start===0&&blocks[0].length>target/2)break;head.push(blocks[start]);used+=blocks[start].length+2;start++;}
 if(!head.length){const cut=Math.floor(target/4),at=Math.max(blocks[0].lastIndexOf('\n',cut),blocks[0].lastIndexOf('. ',cut)+1);const split=at>cut/2?at:cut;head.push(blocks[0].slice(0,split).trimEnd());blocks[0]=blocks[0].slice(split).trimStart();used+=head[0].length+2;}
 let end=blocks.length;
 const keep=new Set<number>();for(let i=start;i<blocks.length;i++)if(pinned.test(blocks[i])&&blocks[i].length<=2500&&used+blocks[i].length+2<=target){keep.add(i);used+=blocks[i].length+2;}
 while(end>start){const i=end-1;if(keep.has(i)){end--;continue;}if(used+blocks[i].length+2>target)break;used+=blocks[i].length+2;end--;}
 const moved:string[]=[];for(let i=start;i<blocks.length;i++){if(keep.has(i))tail.push(blocks[i]);else if(i<end)moved.push(blocks[i]);else tail.push(blocks[i]);}
 if(!moved.length){const last=tail.pop()||'',room=Math.max(0,target-used+last.length);moved.push(last.slice(0,last.length-room));if(room)tail.push(last.slice(last.length-room));}
 return {kept:[...head,pointer,...tail].join('\n\n'),moved:moved.join('\n\n')};
}
export const historyPath=(noteId:string)=>'project-boards/history/card-'+noteId+'.md';
export function historyPointer(noteId:string,russian:boolean){return russian?`[Более ранняя история перенесена без изменений: ${historyPath(noteId)}]`:`[Earlier history moved word for word: ${historyPath(noteId)}]`;}

/**
 * Tolerant reader. `inspect` keeps every readable record for display and lists what breaks the contract;
 * `repair` additionally brings each record back inside it and returns the removed text for the history files.
 * Nothing is written here.
 */
export function normalizeBoard(raw:unknown,mode:'inspect'|'repair'='inspect',newId:()=>string=()=>crypto.randomUUID()):BoardInspection{
 const issues:BoardIssue[]=[],moved:MovedText[]=[],fixing=mode==='repair';
 const problem=(scope:BoardIssue['scope'],path:string,code:string,message:string,extra:Partial<BoardIssue>={})=>{issues.push({severity:'error',scope,path,code,message,...extra});};
 const empty:BoardSnapshot={format:'pocket-code-board',version:1,name:'Board',versions:[],notes:[]};
 if(!isObject(raw)){problem('board','$','not_object','The board file must contain one JSON object.');return {board:empty,issues,moved};}
 const known=['format','version','name','versions','notes','canvas','versionBranches'];
 for(const key of Object.keys(raw))if(!known.includes(key)){problem('board','$.'+key,'unknown_field',`Unknown board field "${key}".`,{field:key,fix:'The field is moved to the repair report.'});if(fixing)moved.push({title:'Board',label:'Unknown board field '+key,text:JSON.stringify(raw[key],null,2)});}
 if(raw.format!=='pocket-code-board')problem('board','$.format','format','The file is not a Pocket Code board (format must be "pocket-code-board").',{field:'format',actual:short(raw.format)});
 if(raw.version!==1)problem('board','$.version','version',typeof raw.version==='number'&&raw.version>1?'The board was saved by a newer Pocket Code. Update the PC host to open it.':'Board version must be 1.',{field:'version',actual:short(raw.version)});
 const text=(scope:BoardIssue['scope'],value:unknown,path:string,field:string,min:number,max:number,who:Partial<BoardIssue>,fallback:string)=>{
  if(typeof value!=='string'){problem(scope,path,'type',`${field} must be text.`,{...who,field,actual:short(value),fix:'Replaced with '+(fallback?`"${fallback}"`:'empty text')+'.'});return fallback;}
  if(value.length<min){problem(scope,path,'too_short',`${field} is empty.`,{...who,field,limit:min,actual:value.length,fix:`Replaced with "${fallback}".`});return fallback;}
  if(value.length>max)problem(scope,path,'too_long',`${field} is ${count(value.length)} characters; the limit is ${count(max)}.`,{...who,field,limit:max,actual:value.length,fix:field==='description'?'Older paragraphs are moved word for word to the card history file.':'Shortened; the full text is kept in the history file.'});
  return value;
 };
 const number=(scope:BoardIssue['scope'],value:unknown,path:string,field:string,min:number,max:number,who:Partial<BoardIssue>,fallback=min)=>{
  if(typeof value!=='number'||!Number.isFinite(value)){problem(scope,path,'type',`${field} must be a number.`,{...who,field,actual:short(value),fix:`Set to ${fallback}.`});return fallback;}
  if(value<min||value>max){problem(scope,path,'out_of_range',`${field} is ${value}; allowed ${min}–${max}.`,{...who,field,limit:value<min?min:max,actual:value,fix:'Moved inside the allowed range.'});return Math.max(min,Math.min(max,value));}
  return value;
 };
 const shorten=(value:string,max:number)=>value.length>max?value.slice(0,max-1).trimEnd()+'…':value;
 const name=shorten(text('board',raw.name,'$.name','Board name',1,BOARD_LIMITS.name,{},'Board'),fixing?BOARD_LIMITS.name:Infinity);
 const versions:string[]=[];
 if(!Array.isArray(raw.versions))problem('board','$.versions','type','versions must be a list.',{field:'versions',fix:'Replaced with an empty list.'});
 else{raw.versions.forEach((value,i)=>{if(typeof value==='string'&&value.length>=1&&value.length<=BOARD_LIMITS.versionLabel)versions.push(value);else problem('board',`$.versions[${i}]`,'invalid_version','A version label must be text of 1–300 characters.',{field:'versions',actual:short(value),fix:'The entry is removed.'});});
  if(versions.length>BOARD_VERSION_LIMIT)problem('board','$.versions','too_many',`The board has ${versions.length} versions; the limit is ${BOARD_VERSION_LIMIT}.`,{field:'versions',limit:BOARD_VERSION_LIMIT,actual:versions.length});}
 let branches:Record<string,string>|undefined;
 if('versionBranches' in raw){
  if(!isObject(raw.versionBranches))problem('board','$.versionBranches','type','versionBranches must be an object.',{field:'versionBranches',fix:'Removed.'});
  else{branches={};for(const [key,value] of Object.entries(raw.versionBranches)){if(key.length>=1&&key.length<=300&&typeof value==='string'&&value.length>=1&&value.length<=300)branches[key]=value;else problem('board','$.versionBranches.'+key,'invalid_branch','A branch link must map a version label to a branch name of 1–300 characters.',{field:'versionBranches',actual:short(value),fix:'The entry is removed.'});}
   const total=Object.keys(branches).length;
   if(total>BOARD_VERSION_LIMIT){const unused=Object.keys(branches).filter(key=>!versions.includes(key));problem('board','$.versionBranches','too_many',`versionBranches has ${total} entries; the limit is ${BOARD_VERSION_LIMIT}.`,{field:'versionBranches',limit:BOARD_VERSION_LIMIT,actual:total,...(total-unused.length<=BOARD_VERSION_LIMIT?{fix:'Links of versions that are not on the board are removed: '+unused.join(', ')+'.'}:{})});
    if(fixing&&total-unused.length<=BOARD_VERSION_LIMIT){for(const key of unused){moved.push({title:'Board',label:'Branch link of a version that is not on the board',text:key+' -> '+branches[key]});delete branches[key];}}}}
 }
 // ---- cards ----
 const rawNotes=Array.isArray(raw.notes)?raw.notes:[];
 if(!Array.isArray(raw.notes))problem('board','$.notes','type','notes must be a list.',{field:'notes',fix:'Replaced with an empty list.'});
 if(rawNotes.length>BOARD_LIMITS.notes)problem('board','$.notes','too_many',`The board has ${rawNotes.length} cards; the limit is ${BOARD_LIMITS.notes}.`,{field:'notes',limit:BOARD_LIMITS.notes,actual:rawNotes.length});
 const noteKeys=Object.keys(noteFields),notes:PublicNote[]=[],noteIds=new Set<string>();
 const placeholder=(i:number,taken:Set<string>)=>{if(fixing){let value=newId();while(taken.has(value))value=newId();return value;}let n=i,value='';do{value='00000000-0000-4000-9000-'+(n++).toString(16).padStart(12,'0');}while(taken.has(value));return value;};
 const pendingDependencies=new Map<string,{path:string;values:unknown[];who:Partial<BoardIssue>}>();
 rawNotes.forEach((value,i)=>{
  const path=`$.notes[${i}]`;
  if(!isObject(value)){problem('note',path,'not_object','A card must be an object.',{actual:short(value),fix:'The entry is moved to the repair report.'});if(fixing)moved.push({title:'Board',label:'Card entry that is not an object',text:JSON.stringify(value)??String(value)});return;}
  let noteId=value.id as string;const titleHint=typeof value.title==='string'?shorten(value.title,80):undefined;
  if(!isId(value.id)){noteId=placeholder(i,noteIds);problem('note',path+'.id','invalid_id','The card has no valid UUID id.',{title:titleHint,field:'id',actual:short(value.id),fix:'A new id is issued.'});}
  else if(noteIds.has(value.id)){noteId=placeholder(i,noteIds);problem('note',path+'.id','duplicate_id','Another card already uses this id.',{id:value.id,title:titleHint,field:'id',fix:'The later card gets a new id.'});}
  noteIds.add(noteId);
  const who={id:noteId,title:titleHint};
  const extra:Raw={};for(const key of Object.keys(value))if(!noteKeys.includes(key)){extra[key]=value[key];problem('note',path+'.'+key,'unknown_field',`Unknown card field "${key}".`,{...who,field:key,fix:'The field is moved to the card history file.'});}
  if(fixing&&Object.keys(extra).length)moved.push({noteId,title:titleHint||'Untitled',label:'Unknown card fields',text:JSON.stringify(extra,null,2)});
  let title=text('note',value.title,path+'.title','title',1,BOARD_LIMITS.title,who,'Untitled');
  let description=text('note',value.description,path+'.description','description',0,BOARD_LIMITS.description,{...who,title},'');
  if(fixing){
   if(title.length>BOARD_LIMITS.title){moved.push({noteId,title:shorten(title,BOARD_LIMITS.title),label:'Full title',text:title});title=shorten(title,BOARD_LIMITS.title);}
   if(description.length>BOARD_LIMITS.description){const result=archiveDescription(description,historyPointer(noteId,/[а-яё]/i.test(description)));moved.push({noteId,title,label:'Description history',text:result.moved});description=result.kept;}
  }
  const branch=shorten(text('note',value.branch??'',path+'.branch','branch',0,BOARD_LIMITS.branch,who,''),fixing?BOARD_LIMITS.branch:Infinity);
  const pick=<T extends string>(field:'status'|'priority',allowed:readonly T[],synonyms:Record<string,T>,fallback:T):T=>{
   const current=value[field];if(allowed.includes(current as T))return current as T;
   const mapped=typeof current==='string'?synonyms[current.trim().toLowerCase()]||allowed.find(v=>v===current.trim().toLowerCase()):undefined,next=mapped||fallback;
   problem('note',path+'.'+field,'invalid_value',`${field} "${short(current)}" is not allowed. Allowed: ${allowed.join(', ')}.`,{...who,field,actual:short(current),fix:`Changed to "${next}".`});
   if(fixing)moved.push({noteId,title,label:'Original '+field,text:short(current)});return next;
  };
  const status=pick('status',NOTE_STATUSES,statusSynonyms,'idea'),priority=pick('priority',NOTE_PRIORITIES,prioritySynonyms,'normal');
  const x=number('note',value.x,path+'.x','x',0,BOARD_LIMITS.coordinate,who),y=number('note',value.y,path+'.y','y',0,BOARD_LIMITS.coordinate,who);
  if(!Array.isArray(value.dependencies))problem('note',path+'.dependencies','type','dependencies must be a list.',{...who,field:'dependencies',fix:'Replaced with an empty list.'});
  pendingDependencies.set(noteId,{path:path+'.dependencies',values:Array.isArray(value.dependencies)?value.dependencies:[],who});
  const note:PublicNote={id:noteId,title,description,branch,status,priority,x,y,dependencies:[]};
  if('images' in value&&value.images!==undefined){
   const images:{path:string;caption:string}[]=[];
   if(!Array.isArray(value.images))problem('note',path+'.images','type','images must be a list.',{...who,field:'images',fix:'Removed.'});
   else value.images.forEach((image,j)=>{const at=`${path}.images[${j}]`;
    if(!isObject(image)||typeof image.path!=='string'||!boardImagePath.test(image.path)){problem('note',at+'.path','invalid_image','An image must reference project-boards/assets/<sha256>.(png|jpg|webp).',{...who,field:'images',actual:short(isObject(image)?image.path:image),fix:'The reference is moved to the card history file.'});if(fixing)moved.push({noteId,title,label:'Invalid image reference',text:JSON.stringify(image)??String(image)});return;}
    for(const key of Object.keys(image))if(key!=='path'&&key!=='caption')problem('note',at+'.'+key,'unknown_field',`Unknown image field "${key}".`,{...who,field:key,fix:'The field is removed.'});
    let caption=text('note',image.caption??'',at+'.caption','image caption',0,BOARD_LIMITS.caption,who,'');
    if(fixing&&caption.length>BOARD_LIMITS.caption){moved.push({noteId,title,label:'Full image caption ('+image.path.slice(-24)+')',text:caption});caption=shorten(caption,BOARD_LIMITS.caption);}
    images.push({path:image.path,caption});
   });
   if(images.length>BOARD_LIMITS.images){problem('note',path+'.images','too_many',`The card has ${images.length} images; the limit is ${BOARD_LIMITS.images}.`,{...who,field:'images',limit:BOARD_LIMITS.images,actual:images.length,fix:'Extra references are moved to the card history file.'});if(fixing)moved.push({noteId,title,label:'Image references over the limit',text:images.splice(BOARD_LIMITS.images).map(image=>image.path+' — '+image.caption).join('\n')});}
   if(Array.isArray(value.images))note.images=images;
  }
  if('checklist' in value&&value.checklist!==undefined){
   const list:{text:string;done:boolean}[]=[];
   if(!Array.isArray(value.checklist))problem('note',path+'.checklist','type','checklist must be a list.',{...who,field:'checklist',fix:'Removed.'});
   else{value.checklist.forEach((entry,j)=>{const at=`${path}.checklist[${j}]`;
     if(!isObject(entry)||typeof entry.text!=='string'||!entry.text.trim()){problem('note',at,'invalid_checklist','A checklist item needs text and a done flag.',{...who,field:'checklist',actual:short(entry),fix:'The item is removed.'});return;}
     if(typeof entry.done!=='boolean')problem('note',at+'.done','type','done must be true or false.',{...who,field:'checklist',actual:short(entry.done),fix:'Set to false.'});
     for(const key of Object.keys(entry))if(key!=='text'&&key!=='done')problem('note',at+'.'+key,'unknown_field',`Unknown checklist field "${key}".`,{...who,field:key,fix:'The field is removed.'});
     let label=entry.text.trim();if(label.length>BOARD_LIMITS.checklistText){problem('note',at+'.text','too_long',`A checklist item is ${label.length} characters; the limit is ${BOARD_LIMITS.checklistText}.`,{...who,field:'checklist',limit:BOARD_LIMITS.checklistText,actual:label.length,fix:'Shortened; the full text is kept in the history file.'});if(fixing){moved.push({noteId,title,label:'Full checklist item',text:label});label=shorten(label,BOARD_LIMITS.checklistText);}}
     list.push({text:label,done:entry.done===true});});
    if(list.length>BOARD_LIMITS.checklist){problem('note',path+'.checklist','too_many',`The checklist has ${list.length} items; the limit is ${BOARD_LIMITS.checklist}.`,{...who,field:'checklist',limit:BOARD_LIMITS.checklist,actual:list.length,fix:'Extra items are moved to the card history file.'});if(fixing)moved.push({noteId,title,label:'Checklist items over the limit',text:list.splice(BOARD_LIMITS.checklist).map(item=>(item.done?'[x] ':'[ ] ')+item.text).join('\n')});}
    note.checklist=list;}
  }
  if('statusHistory' in value&&value.statusHistory!==undefined){
   const history:{status:NoteStatus;at:string}[]=[];
   if(!Array.isArray(value.statusHistory))problem('note',path+'.statusHistory','type','statusHistory must be a list.',{...who,field:'statusHistory',fix:'Removed.'});
   else{value.statusHistory.forEach((entry,j)=>{if(isObject(entry)&&NOTE_STATUSES.includes(entry.status as NoteStatus)&&typeof entry.at==='string'&&moment.test(entry.at)&&Object.keys(entry).length===2)history.push({status:entry.status as NoteStatus,at:entry.at});else problem('note',`${path}.statusHistory[${j}]`,'invalid_history','A status history entry needs a status and a UTC time such as 2026-11-12T10:00:00Z.',{...who,field:'statusHistory',actual:short(entry),fix:'The entry is removed.'});});
    if(history.length>BOARD_LIMITS.statusHistory){problem('note',path+'.statusHistory','too_many',`statusHistory has ${history.length} entries; the limit is ${BOARD_LIMITS.statusHistory}.`,{...who,field:'statusHistory',limit:BOARD_LIMITS.statusHistory,actual:history.length,fix:'The oldest entries are removed.'});if(fixing)history.splice(0,history.length-BOARD_LIMITS.statusHistory);}
    note.statusHistory=history;}
  }
  notes.push(note);
 });
 // Dependencies are checked after every card has its final id: missing, repeated and cyclic references are reported, never fatal.
 const byId=new Map(notes.map(note=>[note.id,note]));
 for(const note of notes){const pending=pendingDependencies.get(note.id)!,result:string[]=[];
  pending.values.forEach((dependency,j)=>{const at=`${pending.path}[${j}]`;
   if(!isId(dependency)||!byId.has(dependency))problem('note',at,'missing_dependency','The card depends on a card that does not exist.',{...pending.who,field:'dependencies',actual:short(dependency),fix:'The reference is removed.'});
   else if(dependency===note.id)problem('note',at,'self_dependency','The card depends on itself.',{...pending.who,field:'dependencies',fix:'The reference is removed.'});
   else if(!result.includes(dependency))result.push(dependency);});
  if(result.length>BOARD_LIMITS.dependencies){problem('note',pending.path,'too_many',`The card has ${result.length} dependencies; the limit is ${BOARD_LIMITS.dependencies}.`,{...pending.who,field:'dependencies',limit:BOARD_LIMITS.dependencies,actual:result.length,fix:'Extra references are removed.'});if(fixing)result.length=BOARD_LIMITS.dependencies;}
  note.dependencies=result;}
 const state=new Map<string,1|2>();
 const visit=(noteId:string)=>{state.set(noteId,1);const note=byId.get(noteId)!;
  for(const dependency of [...note.dependencies]){const seen=state.get(dependency);
   if(seen===1){problem('note','$.notes','dependency_cycle',`Dependencies form a cycle through "${shorten(byId.get(dependency)!.title,60)}".`,{id:noteId,title:shorten(note.title,80),field:'dependencies',actual:dependency,fix:'The reference that closes the cycle is removed.'});if(fixing){note.dependencies=note.dependencies.filter(value=>value!==dependency);moved.push({noteId,title:note.title,label:'Dependency removed to break a cycle',text:dependency});}}
   else if(!seen)visit(dependency);}
  state.set(noteId,2);};
 for(const note of notes)if(!state.has(note.id))visit(note.id);
 // ---- canvas ----
 let canvas:BoardSnapshot['canvas'];
 if('canvas' in raw&&raw.canvas!==undefined){
  if(!isObject(raw.canvas))problem('board','$.canvas','type','canvas must be an object.',{field:'canvas',fix:'Removed; cards keep their positions.'});
  else{
   const source=raw.canvas;
   for(const key of Object.keys(source))if(!['version','items','links'].includes(key))problem('board','$.canvas.'+key,'unknown_field',`Unknown canvas field "${key}".`,{field:key,fix:'The field is removed.'});
   if(source.version!==1)problem('board','$.canvas.version','version','Canvas version must be 1.',{field:'version',actual:short(source.version)});
   const rawItems=Array.isArray(source.items)?source.items:[],rawLinks=Array.isArray(source.links)?source.links:[];
   if(!Array.isArray(source.items))problem('board','$.canvas.items','type','canvas.items must be a list.',{field:'items'});
   if(!Array.isArray(source.links))problem('board','$.canvas.links','type','canvas.links must be a list.',{field:'links'});
   if(rawItems.length>BOARD_LIMITS.items)problem('board','$.canvas.items','too_many',`The canvas has ${rawItems.length} objects; the limit is ${BOARD_LIMITS.items}.`,{field:'items',limit:BOARD_LIMITS.items,actual:rawItems.length});
   if(rawLinks.length>BOARD_LIMITS.links)problem('board','$.canvas.links','too_many',`The canvas has ${rawLinks.length} connections; the limit is ${BOARD_LIMITS.links}.`,{field:'links',limit:BOARD_LIMITS.links,actual:rawLinks.length});
   const itemKeys=['id','kind','text','description','x','y','width','height','color','chart'],items:NonNullable<BoardSnapshot['canvas']>['items']=[],itemIds=new Set<string>();
   rawItems.forEach((value,i)=>{
    const path=`$.canvas.items[${i}]`;
    if(!isObject(value)){problem('item',path,'not_object','A canvas object must be an object.',{actual:short(value),fix:'The entry is moved to the repair report.'});if(fixing)moved.push({title:'Board',label:'Canvas entry that is not an object',text:JSON.stringify(value)??String(value)});return;}
    const hint=typeof value.text==='string'?shorten(value.text.split('\n')[0],80):undefined;let itemId=value.id as string;
    if(!isId(value.id)){itemId=placeholder(1e6+i,new Set([...itemIds,...noteIds]));problem('item',path+'.id','invalid_id','The canvas object has no valid UUID id.',{title:hint,field:'id',actual:short(value.id),fix:'A new id is issued.'});}
    else if(itemIds.has(value.id)){itemId=placeholder(1e6+i,new Set([...itemIds,...noteIds]));problem('item',path+'.id','duplicate_id','Another canvas object already uses this id.',{id:value.id,title:hint,field:'id',fix:'The later object gets a new id.'});}
    itemIds.add(itemId);const who={id:itemId,title:hint};
    for(const key of Object.keys(value))if(!itemKeys.includes(key)){problem('item',path+'.'+key,'unknown_field',`Unknown canvas field "${key}".`,{...who,field:key,fix:'The field is moved to the repair report.'});if(fixing)moved.push({title:hint||'Canvas object',label:'Unknown canvas field '+key+' of '+itemId,text:JSON.stringify(value[key],null,2)});}
    let kind=value.kind as typeof CANVAS_KINDS[number],unsupported=false;
    if(!CANVAS_KINDS.includes(kind)){unsupported=true;problem('item',path+'.kind','unsupported_kind',`Canvas object type "${short(value.kind)}" is not supported by this Pocket Code. Update the PC host to edit this board.`,{...who,field:'kind',actual:short(value.kind)});kind='sticky';}
    const note=kind==='card'?byId.get(itemId):undefined;
    // A card's text lives in its task record; the canvas keeps only geometry and a readable title, so its copy is never judged.
    let label=note?shorten(note.title,BOARD_LIMITS.itemText):text('item',value.text??'',path+'.text','text',0,BOARD_LIMITS.itemText,who,'');
    if(unsupported)label=`[${short(value.kind)}] `+label;
    let description=note||value.description===undefined?undefined:text('item',value.description,path+'.description','description',0,BOARD_LIMITS.description,who,'');
    if(!note&&fixing){
     if(label.length>BOARD_LIMITS.itemText){moved.push({title:hint||'Canvas object',label:'Full text of canvas object '+itemId,text:label});label=shorten(label,BOARD_LIMITS.itemText);}
     if(description&&description.length>BOARD_LIMITS.description){moved.push({title:hint||'Canvas object',label:'Full description of canvas object '+itemId,text:description});description=shorten(description,BOARD_LIMITS.description);}
    }
    const top=kind==='card'?BOARD_LIMITS.coordinate:BOARD_LIMITS.canvasCoordinate;
    const item:Raw={id:itemId,kind,text:label,...(description===undefined?{}:{description}),x:note?note.x:number('item',value.x,path+'.x','x',0,top,who),y:note?note.y:number('item',value.y,path+'.y','y',0,top,who),width:number('item',value.width,path+'.width','width',120,6000,who,240),height:number('item',value.height,path+'.height','height',80,6000,who,160)};
    if(value.color===undefined||CANVAS_COLORS.includes(value.color as typeof CANVAS_COLORS[number]))item.color=value.color??'sand';
    else{problem('item',path+'.color','invalid_value',`color "${short(value.color)}" is not allowed. Allowed: ${CANVAS_COLORS.join(', ')}.`,{...who,field:'color',actual:short(value.color),fix:'Changed to "sand".'});item.color='sand';}
    if(kind==='chart'){const chart=whiteboardChart.safeParse(value.chart);if(chart.success)item.chart=chart.data;else{const first=chart.error.issues[0];problem('item',path+'.chart'+(first?.path.length?'.'+first.path.join('.'):''),'invalid_chart','The chart data is invalid: '+(first?.message||'unknown problem')+'.',{...who,field:'chart'});item.chart={type:'bar',categories:['—'],series:[{name:'—',values:[0]}]};}}
    else if(value.chart!==undefined&&!unsupported){problem('item',path+'.chart','unknown_field','Only chart objects can carry chart data.',{...who,field:'chart',fix:'The data is moved to the repair report.'});if(fixing)moved.push({title:hint||'Canvas object',label:'Chart data on a non-chart object '+itemId,text:JSON.stringify(value.chart,null,2)});}
    items.push(item as NonNullable<BoardSnapshot['canvas']>['items'][number]);
   });
   const links:NonNullable<BoardSnapshot['canvas']>['links']=[],linkIds=new Set<string>(),linkKeys=['id','from','to','fromPoint','toPoint','fromSide','toSide','label','style'];
   const drop=(value:unknown,path:string,code:string,message:string,linkId?:string)=>{problem('link',path,code,message,{id:linkId,fix:'The connection is moved to the repair report.'});if(fixing)moved.push({title:'Board',label:'Removed canvas connection',text:JSON.stringify(value)??String(value)});};
   rawLinks.forEach((value,i)=>{
    const path=`$.canvas.links[${i}]`;
    if(!isObject(value)){drop(value,path,'not_object','A connection must be an object.');return;}
    const linkId=value.id as string;
    if(!isId(linkId)){drop(value,path+'.id','invalid_id','The connection has no valid UUID id.');return;}
    if(linkIds.has(linkId)){drop(value,path+'.id','duplicate_id','Another connection already uses this id.',linkId);return;}
    const link:Raw={id:linkId};let broken='';
    for(const end of ['from','to'] as const){
     const object=value[end],point=value[end+'Point'],side=value[end+'Side'];
     if(object!==undefined&&point!==undefined||object===undefined&&point===undefined){broken=`Connection ${end} needs exactly one object or free point.`;break;}
     if(object!==undefined){if(!isId(object)||!itemIds.has(object)&&!byId.has(object)){broken=`Connection ${end} points at an object that does not exist.`;break;}link[end]=object;if(side!==undefined){if(!['n','e','s','w'].includes(side as string)){broken=`Connection ${end} side must be n, e, s or w.`;break;}link[end+'Side']=side;}}
     else{if(!isObject(point)||typeof point.x!=='number'||typeof point.y!=='number'||!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.y<0||point.x>106000||point.y>106000||side!==undefined){broken=`Connection ${end} point is outside the canvas.`;break;}link[end+'Point']={x:point.x,y:point.y};}
    }
    if(!broken&&link.from&&link.from===link.to)broken='A connection cannot start and end at the same object.';
    if(broken){drop(value,path,'invalid_link',broken,linkId);return;}
    for(const key of Object.keys(value))if(!linkKeys.includes(key))problem('link',path+'.'+key,'unknown_field',`Unknown connection field "${key}".`,{id:linkId,field:key,fix:'The field is removed.'});
    if(value.label!==undefined){if(typeof value.label==='string'&&value.label.trim().length>=1&&value.label.trim().length<=200)link.label=value.label.trim();else problem('link',path+'.label','invalid_value','A connection label must be text of 1–200 characters.',{id:linkId,field:'label',actual:short(value.label),fix:'The label is removed.'});}
    if(value.style!==undefined){if(['arrow','line','dashed'].includes(value.style as string))link.style=value.style;else problem('link',path+'.style','invalid_value','Connection style must be arrow, line or dashed.',{id:linkId,field:'style',actual:short(value.style),fix:'The style is removed.'});}
    linkIds.add(linkId);links.push(link as NonNullable<BoardSnapshot['canvas']>['links'][number]);
   });
   // Every card is on the canvas: a connection may reference a card that has no stored geometry yet.
   for(const note of notes)if(!itemIds.has(note.id)&&links.some(link=>link.from===note.id||link.to===note.id)){items.push({id:note.id,kind:'card',text:shorten(note.title,BOARD_LIMITS.itemText),x:note.x,y:note.y,width:280,height:280,color:'sand'});itemIds.add(note.id);}
   canvas={version:1,items:fixing?items.slice(0,BOARD_LIMITS.items):items,links:fixing?links.slice(0,BOARD_LIMITS.links):links};
  }
 }
 const board:BoardSnapshot={format:'pocket-code-board',version:1,name,...(canvas?{canvas}:{}),...(branches?{versionBranches:branches}:{}),versions,notes};
 return {board,issues,moved};
}

/** Warnings never block editing: they tell the author what is close to a limit before a write is refused. */
export function boardWarnings(board:BoardSnapshot,fileBytes=0):BoardIssue[]{
 const result:BoardIssue[]=[],near=(scope:BoardIssue['scope'],path:string,field:string,actual:number,limit:number,what:string,who:Partial<BoardIssue>={})=>{if(actual>=limit*NEAR_LIMIT)result.push({severity:'warning',scope,path,code:'near_limit',field,limit,actual,message:`${what} uses ${count(actual)} of ${count(limit)}.`,...who});};
 board.notes.forEach((note,i)=>{const who={id:note.id,title:note.title.length>80?note.title.slice(0,79)+'…':note.title};
  near('note',`$.notes[${i}].description`,'description',note.description.length,BOARD_LIMITS.description,'The card description',who);});
 (board.canvas?.items||[]).forEach((item,i)=>{if(item.kind!=='card')near('item',`$.canvas.items[${i}].text`,'text',item.text.length,BOARD_LIMITS.itemText,'The object text',{id:item.id,title:item.text.split('\n')[0].slice(0,80)});});
 near('board','$.notes','notes',board.notes.length,BOARD_LIMITS.notes,'The card count');
 near('board','$.canvas.items','items',board.canvas?.items.length||0,BOARD_LIMITS.items,'The canvas object count');
 near('board','$.canvas.links','links',board.canvas?.links.length||0,BOARD_LIMITS.links,'The connection count');
 near('board','$.versions','versions',board.versions.length,BOARD_VERSION_LIMIT,'The version list');
 near('board','$','fileBytes',fileBytes,BOARD_LIMITS.fileBytes,'The board file size in bytes');
 return result;
}

/** A refused write names the record, the field and the limit instead of a bare "check the request fields". */
export function issuesFromZod(error:z.ZodError,payload:unknown):BoardIssue[]{
 const root=isObject(payload)?payload:{};
 return error.issues.slice(0,40).map(issue=>{
  const parts=issue.path.map(String),at=(index:number)=>parts[index];let scope:BoardIssue['scope']='board',record:Raw|undefined;
  if(at(0)==='notes'&&at(1)!==undefined){scope='note';record=(root.notes as Raw[]|undefined)?.[Number(at(1))];}
  else if(at(0)==='canvas'&&at(1)==='items'&&at(2)!==undefined){scope='item';record=((root.canvas as Raw|undefined)?.items as Raw[]|undefined)?.[Number(at(2))];}
  else if(at(0)==='canvas'&&at(1)==='links'&&at(2)!==undefined){scope='link';record=((root.canvas as Raw|undefined)?.links as Raw[]|undefined)?.[Number(at(2))];}
  const field=parts.slice(scope==='board'?0:scope==='note'?2:3).filter(part=>!/^\d+$/.test(part)).join('.')||undefined;
  let value:unknown=root;for(const part of parts)value=isObject(value)||Array.isArray(value)?(value as Raw)[part]:undefined;
  const detail=issue as unknown as {code:string;maximum?:number;minimum?:number;origin?:string};
  const limit=detail.code==='too_big'?Number(detail.maximum):detail.code==='too_small'?Number(detail.minimum):undefined;
  const actual=typeof value==='string'||Array.isArray(value)?value.length:typeof value==='number'?value:value===undefined?undefined:short(value);
  const title=isObject(record)&&typeof (record.title??record.text)==='string'?String(record.title??record.text).split('\n')[0].slice(0,80):undefined;
  const subject=field||'value',unit=typeof value==='string'?' characters':Array.isArray(value)?' entries':'';
  const message=detail.code==='too_big'&&limit!==undefined?`${subject} is ${typeof actual==='number'?count(actual):actual}${unit}; the limit is ${count(limit)}.`:detail.code==='too_small'&&limit!==undefined?`${subject} is ${typeof actual==='number'?count(actual):actual}${unit}; the minimum is ${count(limit)}.`:`${subject}: ${issue.message}${actual!==undefined&&typeof actual!=='number'?` (got ${actual})`:''}.`;
  return {severity:'error' as const,scope,...(isObject(record)&&typeof record.id==='string'?{id:record.id}:{}),...(title?{title}:{}),path:'$.'+parts.map(part=>/^\d+$/.test(part)?`[${part}]`:part).join('.').replace(/\.\[/g,'['),...(field?{field}:{}),code:detail.code==='too_big'?'too_long':detail.code==='too_small'?'too_short':'invalid_value',...(limit===undefined?{}:{limit}),...(actual===undefined?{}:{actual}),message};
 });
}
const scopeName={board:'Board',note:'Card',item:'Canvas object',link:'Connection'} as const;
export function describeIssue(issue:BoardIssue){const who=issue.scope==='board'?'Board':`${scopeName[issue.scope]}${issue.title?` "${issue.title}"`:''}${issue.id?` (${issue.id.slice(0,8)})`:''}`;return `${who}: ${issue.message}`;}
export function describeIssues(issues:BoardIssue[],limit=8){const errors=boardErrors(issues),shown=errors.slice(0,limit).map(describeIssue);if(errors.length>limit)shown.push(`…and ${errors.length-limit} more.`);return shown.join('\n');}
