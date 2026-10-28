import type {Block} from '../server/types';
import {t} from './i18n';

/** What a tool call means to the person reading the transcript, independent of the provider that ran it. */
export type ToolKind='explore'|'command'|'edit'|'plan'|'agent'|'question'|'web'|'tool';
export type ToolStatus='pending'|'running'|'done'|'failed'|'denied'|'nomatch';
export type ToolView={kind:ToolKind;title:string;mono:boolean;status:ToolStatus;active:boolean;failed:boolean;done:boolean;command?:string;files:string[];added:number;removed:number;search:boolean;errorLines:string[];plan?:PlanItem[];mcp?:string};
export type PlanItem={text:string;status:'completed'|'in_progress'|'pending';active?:string};

type Input=Record<string,unknown>;
const str=(value:unknown)=>typeof value==='string'?value:'';
export const stripAnsi=(text:string)=>text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g,'');
export const basename=(value:string)=>value.replace(/[\\/]+$/,'').split(/[\\/]/).pop()||value;
const lines=(text:string)=>text?text.replace(/\r\n/g,'\n').replace(/\n$/,'').split('\n').length:0;
/** Plain text of a tool result, whichever provider shape it uses. */
export function toolText(content:unknown):string{
  if(typeof content==='string')return content;
  if(Array.isArray(content))return content.map(item=>item&&typeof item==='object'&&typeof (item as Input).text==='string'?(item as Input).text as string:'').filter(Boolean).join('\n');
  return '';
}
/** Changed lines for a replacement, ignoring the unchanged lines it repeats at either end. */
function replaced(before:string,after:string){
  const a=before.replace(/\r\n/g,'\n').split('\n'),b=after.replace(/\r\n/g,'\n').split('\n');
  let start=0;while(start<a.length&&start<b.length&&a[start]===b[start])start++;
  let end=0;while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++;
  return {added:before||after?b.length-start-end:0,removed:before?a.length-start-end:0};
}
function patchCounts(patch:string){
  const files=[...patch.matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm),...patch.matchAll(/^\+\+\+ (?:b\/)?(.+)$/gm)].map(match=>match[1].trim()).filter(file=>file!=='/dev/null');
  let added=0,removed=0;for(const line of patch.split(/\r?\n/)){if(/^\+(?!\+\+)/.test(line))added++;else if(/^-(?!--)/.test(line))removed++;}
  return {files:[...new Set(files)],added,removed};
}
function editStats(name:string,input:Input){
  const file=str(input.file_path)||str(input.path)||str(input.notebook_path);
  if(Array.isArray(input.changes)){
    let added=0,removed=0;const files:string[]=[];
    for(const change of input.changes as Input[]){if(!change||typeof change!=='object')continue;if(str(change.path))files.push(str(change.path));const diff=str(change.diff),counts=patchCounts(diff);const kind=str((change.kind as Input|undefined)?.type)||str(change.kind);if(kind==='add'&&!counts.added&&!counts.removed)added+=lines(diff);else{added+=counts.added;removed+=counts.removed;}}
    return {files,added,removed};
  }
  const patch=str(input.patch)||str(input.input)||(name==='apply_patch'?str(input.content):'');
  if(patch){const counts=patchCounts(patch);return {files:counts.files.length?counts.files:file?[file]:[],added:counts.added,removed:counts.removed};}
  if(Array.isArray(input.edits)){let added=0,removed=0;for(const edit of input.edits as Input[]){const counts=replaced(str(edit?.old_string),str(edit?.new_string));added+=counts.added;removed+=counts.removed;}return {files:file?[file]:[],added,removed};}
  const content=str(input.content)||str(input.file_text);
  if(content&&!('old_string' in input)&&!('old_str' in input))return {files:file?[file]:[],added:lines(content),removed:0};
  const counts=replaced(str(input.old_string)||str(input.old_str),str(input.new_string)||str(input.new_str));
  return {files:file?[file]:[],...counts};
}
export function planItems(name:string,input:Input):PlanItem[]|undefined{
  const status=(value:unknown):PlanItem['status']=>value==='completed'||value==='complete'||value==='done'?'completed':value==='in_progress'||value==='inProgress'||value==='active'?'in_progress':'pending';
  if(Array.isArray(input.todos))return (input.todos as Input[]).filter(item=>item&&typeof item==='object').map(item=>({text:str(item.content)||str(item.subject),status:status(item.status),active:str(item.activeForm)||undefined}));
  if(Array.isArray(input.plan))return (input.plan as Input[]).filter(item=>item&&typeof item==='object').map(item=>({text:str(item.step)||str(item.content),status:status(item.status)}));
  return /^(todowrite|update_plan|todo_write)$/i.test(name)?[]:undefined;
}
const mcpTools:Record<string,string>={take_screenshot:'Скриншот',screenshot:'Скриншот',navigate:'Открыл страницу',click:'Нажатие',snapshot:'Снимок страницы',type:'Ввод текста',fill_form:'Заполнение формы',evaluate:'Выполнение скрипта',wait_for:'Ожидание',close:'Закрыл браузер',resize:'Размер окна',press_key:'Нажатие клавиши',hover:'Наведение',select_option:'Выбор варианта',console_messages:'Сообщения консоли',network_requests:'Сетевые запросы',tabs:'Вкладки'};
function mcpName(name:string){
  const match=/^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/.exec(name)||/^([\w.-]+)\/([\w.-]+)$/.exec(name);
  if(!match)return null;
  const server=match[1].replace(/[-_]+/g,' ').replace(/\b\w/g,char=>char.toUpperCase()),raw=match[2].replace(/^browser_/,'');
  return {server,tool:mcpTools[raw]?t(mcpTools[raw]):raw.replace(/_/g,' ')};
}
/** Error lines worth showing under the row without opening it. */
function errorTail(text:string){return stripAnsi(text).split(/\r?\n/).map(line=>line.trim()).filter(Boolean).slice(-3).map(line=>line.length>200?line.slice(0,199)+'…':line);}

/** One registry for Claude, Codex and Copilot tools: a title naming the object, a kind for grouping and an explicit state. */
export function describeTool(block:Block,result?:Block,running=false):ToolView{
  const name=block.name||'',input=(block.input&&typeof block.input==='object'?block.input:{}) as Input,rawStatus=str(input.status).toLowerCase();
  const text=result?toolText(result.content):'',denied=rawStatus==='declined'||Boolean(result?.is_error&&/user (?:denied|rejected)|doesn't want to proceed|permission denied by user/i.test(text));
  let failed=Boolean(result?.is_error)||['failed','error','declined'].includes(rawStatus);
  const active=!failed&&(['inprogress','in_progress','running'].includes(rawStatus)||(!result&&!rawStatus&&running));
  const done=Boolean(result)||['completed','complete','success'].includes(rawStatus);
  const view:ToolView={kind:'tool',title:name||t('Действие'),mono:false,status:'pending',active,failed,done,files:[],added:0,removed:0,search:false,errorLines:[]};
  const verb=(present:string,past:string,...values:unknown[])=>t(active?present:past,...values);
  const lower=name.toLowerCase(),mcp=mcpName(name);
  if(/^(bash|command|exec_command|write_stdin|shell|terminal|powershell|local_shell)$/.test(lower)){
    const command=str(input.command)||str(input.cmd)||(Array.isArray(input.command)?(input.command as unknown[]).map(String).join(' '):'');
    Object.assign(view,{kind:'command',command:command||undefined,mono:false,title:verb('Выполняет команду','Выполнил команду')});
    // grep/rg/findstr report "no matches" through exit code 1 without output; that is an answer, not a failure.
    if(failed&&!denied&&/^\s*(?:rg|grep|findstr|git grep|select-string)\b/i.test(command)&&!stripAnsi(text).replace(/exit code:? ?1/i,'').trim()){failed=false;view.failed=false;view.status='nomatch';}
  }else if(/^(read|view|read_file|readfile|notebookread|open_file)$/.test(lower)){
    const file=str(input.file_path)||str(input.path)||str(input.notebook_path);
    Object.assign(view,{kind:'explore',files:file?[file]:[],title:file?verb('Читает {0}','Прочитал {0}',basename(file)):verb('Читает файл','Прочитал файл')});
  }else if(/^(grep|search|search_files|grep_search|codebase_search|rg)$/.test(lower)){
    const pattern=str(input.pattern)||str(input.query)||str(input.regex),where=str(input.path)||str(input.glob)||str(input.include);
    Object.assign(view,{kind:'explore',search:true,title:pattern?where?t('Поиск «{0}» в {1}',pattern,basename(where)):t('Поиск «{0}»',pattern):t('Поиск')});
    if(failed&&!denied&&!stripAnsi(text).replace(/exit code:? ?1|no (?:matches|files) found/ig,'').trim()){failed=false;view.failed=false;view.status='nomatch';}
  }else if(/^(glob|ls|list_dir|list_directory|find_files|file_search)$/.test(lower)){
    const pattern=str(input.pattern)||str(input.path)||str(input.query)||str(input.dir);
    Object.assign(view,{kind:'explore',search:true,title:lower==='ls'||lower.startsWith('list')?t('Список файлов {0}',basename(pattern||'.')):t('Поиск файлов {0}',pattern)});
  }else if(/^(edit|multiedit|write|create|str_replace|str_replace_editor|str_replace_based_edit_tool|apply_patch|file changes|notebookedit|insert|delete_file)$/.test(lower)){
    const stats=editStats(lower,input),first=stats.files[0]?basename(stats.files[0]):'',target=stats.files.length>1?t('{0} и ещё {1}',first,stats.files.length-1):first;
    const created=/^(write|create)$/.test(lower)&&!('old_string' in input),removedFile=lower==='delete_file';
    Object.assign(view,{kind:'edit',...stats,title:!target?verb('Изменяет файлы','Изменил файлы'):removedFile?verb('Удаляет {0}','Удалил {0}',target):created?verb('Записывает {0}','Записал {0}',target):verb('Изменяет {0}','Изменил {0}',target)});
  }else if(planItems(name,input)){
    const items=planItems(name,input)!,complete=items.filter(item=>item.status==='completed').length;
    Object.assign(view,{kind:'plan',plan:items,title:items.length?t('План · {0}/{1}',complete,items.length):t('План')});
  }else if(/^(exitplanmode|exit_plan_mode)$/.test(lower)){Object.assign(view,{kind:'plan',title:t('Предложил план')});}
  else if(/^(taskcreate|taskupdate|tasklist|taskget)$/.test(lower)){Object.assign(view,{kind:'plan',title:str(input.subject)?t('Задача плана · {0}',str(input.subject)):t('Обновил план')});}
  else if(/^(task|agent)$/.test(lower)){Object.assign(view,{kind:'agent',title:t('Субагент · {0}',str(input.description)||str(input.subagent_type)||t('задание'))});}
  else if(/^(askuserquestion|ask_user|request_user_input)$/.test(lower)){Object.assign(view,{kind:'question',title:t('Вопрос')});}
  else if(/^(webfetch|web_fetch|fetch)$/.test(lower)){let host=str(input.url);try{host=new URL(host).host;}catch{/* Keep the raw value. */}Object.assign(view,{kind:'web',title:verb('Открывает {0}','Открыл {0}',host)});}
  else if(/^(websearch|web search|web_search)$/.test(lower)){Object.assign(view,{kind:'web',search:true,title:t('Поиск в интернете «{0}»',str(input.query)||str((input.action as Input|undefined)?.query))});}
  else if(mcp){Object.assign(view,{kind:'tool',mcp:mcp.server,title:`${mcp.server} · ${mcp.tool}`});}
  if(view.status!=='nomatch')view.status=denied?'denied':failed?'failed':active?'running':done?'done':'pending';
  if(failed)view.errorLines=errorTail(text);
  return view;
}
