import type {JobView, WritePreview} from './types.js';

const MAX_CONTENT = 16_384, MAX_PATH = 4096, MAX_PREVIEWS = 8;
const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 256;

class ReceivedText {
  content = '';
  totalBytes = 0;
  private breaks = 0;
  truncated = false;

  append(text: string) {
    if (!text) return;
    // A JSON unicode escape (or an SDK delta) can split one UTF-8 scalar into two JS code units.
    const joinsPair = /[\uD800-\uDBFF]$/.test(this.content) && /^[\uDC00-\uDFFF]/.test(text);
    this.totalBytes += Buffer.byteLength(text) - (joinsPair ? 2 : 0);
    for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i+1)) this.breaks++;
    this.content += text;
    if (this.content.length > MAX_CONTENT) {
      this.truncated = true;
      this.content = this.content.slice(-MAX_CONTENT).replace(/^[\uDC00-\uDFFF]/, '');
    }
  }
  view(id: string, tool: WritePreview['tool'], path: string): WritePreview {
    return {id, tool, path, content:this.content, totalBytes:this.totalBytes,
      totalLines:this.breaks + (this.content && !this.content.endsWith('\n') ? 1 : 0),
      ...(this.truncated ? {truncated:true} : {})};
  }
}

const escapes: Record<string,string> = {'"':'"', '\\':'\\', '/':'/', b:'\b', f:'\f', n:'\n', r:'\r', t:'\t'};
type Schema = {tool:'Write'|'Edit';path:string;content:string};
const schemas = new Map<string,Schema>([
  ['Write', {tool:'Write',path:'file_path',content:'content'}],
  ['Edit', {tool:'Edit',path:'file_path',content:'new_string'}],
  ['create', {tool:'Write',path:'path',content:'file_text'}],
  ['edit', {tool:'Edit',path:'path',content:'new_str'}],
]);

/** Recognize only two direct string properties of the tool input, including an unfinished
 * content string. Never collect unknown properties, nested objects or the raw argument stream. */
class ToolInput {
  private depth = 0;
  private field = '';
  private expecting: 'start'|'key'|'colon'|'value'|'separator'|'done' = 'start';
  private reading: 'key'|'path'|'content'|'skip'|null = null;
  private escaped = false;
  private unicode: string|null = null;
  private path = '';
  private havePath = false;
  private text = new ReceivedText();
  private pendingText = '';
  private haveContent = false;
  private invalid = false;
  constructor(readonly id:string, readonly schema:Schema) {}

  private decoded(value:string) {
    if (this.reading === 'content') {
      this.pendingText += value;
      if (this.pendingText.length >= MAX_CONTENT) this.flushText();
    }
    else if (this.reading === 'key') this.field = (this.field + value).slice(0,64);
    else if (this.reading === 'path') {
      if (this.path.length + value.length > MAX_PATH) this.invalid = true;
      else this.path += value;
    }
  }
  private flushText() {this.text.append(this.pendingText);this.pendingText='';}
  append(fragment:string) {
    for (let i=0; i<fragment.length && !this.invalid && this.expecting !== 'done'; i++) {
      const c=fragment[i];
      if (this.reading !== null) {
        if (this.unicode !== null) {
          if (!/^[a-f0-9]$/i.test(c)) { this.invalid=true; continue; }
          this.unicode += c;
          if (this.unicode.length===4) {this.decoded(String.fromCharCode(parseInt(this.unicode,16))); this.unicode=null;}
        } else if (this.escaped) {
          this.escaped=false;
          if (c==='u') this.unicode='';
          else if (Object.hasOwn(escapes,c)) this.decoded(escapes[c]);
          else this.invalid=true;
        } else if (c==='\\') this.escaped=true;
        else if (c==='"') {
          if (this.reading==='content') this.flushText();
          if (this.reading==='path') this.havePath=true;
          if (this.reading==='key') this.expecting='colon';
          this.reading=null;
        } else {
          let end=i+1;
          while(end<fragment.length && fragment[end]!=='"' && fragment[end]!=='\\') end++;
          this.decoded(fragment.slice(i,end));i=end-1;
        }
        continue;
      }
      if (/\s/.test(c)) continue;
      if (this.expecting==='start') {
        if (c!=='{') this.invalid=true;
        else {this.depth=1;this.expecting='key';}
        continue;
      }
      if (this.depth>1) {
        if (c==='"') this.reading='skip';
        else if (c==='{' || c==='[') this.depth++;
        else if (c==='}' || c===']') this.depth--;
        continue;
      }
      if (c==='}') { this.expecting='done'; continue; }
      if (this.expecting==='key' && c==='"') {this.field='';this.reading='key';continue;}
      if (this.expecting==='colon' && c===':') {this.expecting='value';continue;}
      if (this.expecting==='value') {
        this.expecting='separator';
        if (c==='"') {
          if (this.field===this.schema.path) {this.path='';this.havePath=false;this.reading='path';}
          else if (this.field===this.schema.content) {this.text=new ReceivedText();this.haveContent=true;this.reading='content';}
          else this.reading='skip';
        } else if (c==='{' || c==='[') this.depth++;
        continue;
      }
      if (this.expecting==='separator' && c===',') this.expecting='key';
    }
    this.flushText();
  }
  view() {
    if(this.invalid||!this.haveContent||!this.text.totalBytes&&!this.havePath)return;
    return this.text.view(this.id,this.schema.tool,this.havePath?this.path:'');
  }
}

/** Lives only in the running provider driver; public snapshots contain decoded fields only. */
export class ToolInputPreviews {
  private inputs = new Map<string,ToolInput>();
  private indices = new Map<number,string>();

  start(id:unknown,name:unknown,index?:number) {
    if (typeof name!=='string' || !validId(id) || this.inputs.has(id) || this.inputs.size>=MAX_PREVIEWS) return;
    const schema=schemas.get(name);
    if (!schema) return;
    this.inputs.set(id,new ToolInput(id,schema));
    if (index!==undefined) this.indices.set(index,id);
  }
  append(job:JobView,idOrIndex:unknown,fragment:unknown,name?:string) {
    const id=typeof idOrIndex==='number' ? this.indices.get(idOrIndex) : idOrIndex;
    if (!validId(id) || typeof fragment!=='string') return;
    if (name && !this.inputs.has(id)) this.start(id,name);
    const input=this.inputs.get(id);
    if (!input) return;
    input.append(fragment);
    const preview=input.view();
    if (preview || job.writePreviews?.some(item=>item.id===id)) replacePreviews(job,id,preview?[preview]:[]);
  }
  remove(job:JobView,id:unknown) {
    if (!validId(id)) return;
    this.inputs.delete(id);
    for (const [index,tool] of this.indices) if (tool===id) this.indices.delete(index);
    removeWritePreview(job,id);
  }
  clear(job:JobView) {this.inputs.clear();this.indices.clear();delete job.writePreviews;}
  endBlock(index:number) {this.indices.delete(index);}
}
function replacePreviews(job:JobView,id:string,items:WritePreview[]) {
  const previews=[...(job.writePreviews||[]).filter(item=>item.id!==id),...items].slice(0,MAX_PREVIEWS);
  if(previews.length) job.writePreviews=previews;
  else delete job.writePreviews;
}
export function removeWritePreview(job:JobView,id:string) {
  if(job.writePreviews?.some(item=>item.id===id)) replacePreviews(job,id,[]);
}
export function updatePatchPreviews(job:JobView,id:unknown,changes:unknown) {
  if(!validId(id)||!Array.isArray(changes)) return;
  const items:WritePreview[]=[];
  for(const change of changes.slice(0,MAX_PREVIEWS)) {
    if(typeof change?.path!=='string'||!change.path||change.path.length>MAX_PATH||typeof change.diff!=='string') continue;
    const text=new ReceivedText();text.append(change.diff);items.push(text.view(id,'Patch',change.path));
  }
  replacePreviews(job,id,items);
}
