import {useEffect,useRef,useState} from 'react';
import {TriangleAlert,Wrench,History,ChevronDown,ChevronUp,Crosshair} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import type {BoardIssue} from './board-contract';
import type {BoardView} from './WorkBoards';
import './board-health.css';

type Backup={id:string;savedAt:number;bytes:number;valid:boolean};
const fieldNames:Record<string,string>={description:'описание',title:'название','image caption':'подпись изображения',priority:'приоритет',status:'статус',branch:'версия',images:'изображения',dependencies:'зависимости',checklist:'чек-лист',statusHistory:'история статусов',text:'текст',color:'цвет',kind:'тип объекта',chart:'данные графика',notes:'карточки',items:'объекты холста',links:'связи',versions:'версии',versionBranches:'ссылки на ветки',fileBytes:'размер файла, байт',x:'координата x',y:'координата y',width:'ширина',height:'высота',id:'идентификатор'};
const fixNames:[RegExp,string][]=[[/moved word for word to the card history/,'Старые абзацы будут дословно перенесены в файл истории карточки.'],[/Shortened/,'Текст будет сокращён, полный сохранится в файле истории.'],[/Changed to "(.+)"/,'Значение будет заменено на «$1».'],[/reference is removed|entry is removed|item is removed|label is removed|style is removed/,'Запись будет убрана и сохранена в отчёте о починке.'],[/moved to the (card history file|repair report)/,'Запись будет перенесена в файл истории.'],[/new id is issued|gets a new id/,'Будет выдан новый идентификатор.'],[/Moved inside the allowed range|Set to/,'Значение будет приведено к допустимому.'],[/Links of versions that are not on the board/,'Ссылки на ветки версий, которых нет на доске, будут убраны.'],[/Restore the last good snapshot/,'Откатите доску к последней исправной версии или исправьте файл вручную.']];
/** The host reports issues in English with structured fields; the Russian interface rebuilds the sentence from them. */
export function issueText(issue:BoardIssue,ru:boolean){
 if(!ru)return issue.message;
 const field=fieldNames[issue.field||'']||issue.field||'значение',name=field[0].toUpperCase()+field.slice(1),n=(value:unknown)=>typeof value==='number'?value.toLocaleString('ru-RU'):String(value??'');
 switch(issue.code){
  case 'too_long':return `${name}: ${n(issue.actual)} символов при лимите ${n(issue.limit)}.`;
  case 'too_short':return `${name}: пусто.`;
  case 'near_limit':return `${name}: занято ${n(issue.actual)} из ${n(issue.limit)}.`;
  case 'too_many':return `${name}: ${n(issue.actual)} при лимите ${n(issue.limit)}.`;
  case 'invalid_value':return `${name} «${n(issue.actual)}» — недопустимое значение.`;
  case 'out_of_range':return `${name}: значение ${n(issue.actual)} вне допустимого диапазона.`;
  case 'type':return `${name}: неверный тип значения.`;
  case 'unknown_field':return `Неизвестное поле «${issue.field}».`;
  case 'missing_dependency':return 'Зависимость от карточки, которой нет на доске.';
  case 'self_dependency':return 'Карточка зависит сама от себя.';
  case 'dependency_cycle':return 'Зависимости карточек образуют цикл.';
  case 'duplicate_id':return 'Идентификатор уже занят другой записью.';
  case 'invalid_id':return 'У записи нет корректного идентификатора (UUID).';
  case 'not_object':return 'Запись не является объектом.';
  case 'invalid_link':return 'Связь указывает на несуществующий объект или задана неверно.';
  case 'invalid_image':return 'Ссылка на изображение вне папки project-boards/assets.';
  case 'unsupported_kind':return `Тип объекта «${n(issue.actual)}» не поддерживается этой версией Pocket Code. Обновите хост на ПК.`;
  case 'invalid_chart':return 'Данные графика заданы неверно.';
  case 'invalid_json':return 'Файл доски — не корректный JSON'+(/(\(line \d+, column \d+\))/.exec(issue.message)?.[1].replace('line','строка').replace('column','столбец').replace(/^/,' ')||'')+'.';
  case 'file_too_large':return `Файл доски: ${n(issue.actual)} байт при лимите ${n(issue.limit)}.`;
  case 'version':return 'Доска сохранена более новой версией Pocket Code. Обновите хост на ПК.';
  case 'format':return 'Файл не является доской Pocket Code.';
  default:return issue.message;
 }
}
export function issueSubject(issue:BoardIssue,ru:boolean){
 const kind=issue.scope==='note'?(ru?'Карточка':'Card'):issue.scope==='item'?(ru?'Объект':'Object'):issue.scope==='link'?(ru?'Связь':'Connection'):(ru?'Доска':'Board');
 return issue.title?`${kind} «${issue.title}»`:kind;
}
function issueFix(issue:BoardIssue,ru:boolean){if(!issue.fix)return '';if(!ru)return issue.fix;for(const [pattern,text] of fixNames){const match=pattern.exec(issue.fix);if(match)return text.replace('$1',match[1]||'');}return issue.fix;}
const moment=(value:number,ru:boolean)=>new Date(value).toLocaleString(ru?'ru-RU':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

function RestoreDialog({connection,board,onClose,onBoard}:{connection:Connection;board:BoardView;onClose():void;onBoard(board:BoardView):void}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en,dialog=useRef<HTMLElement|null>(null);
 const [backups,setBackups]=useState<Backup[]|null>(null),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useModal(dialog,true,()=>{if(!busy)onClose();});
 useEffect(()=>{let alive=true;request<{backups:Backup[]}>(connection,'/project-board/backups?root='+encodeURIComponent(board.root)).then(result=>{if(!alive)return;setBackups(result.backups);setSelected(result.backups.find(entry=>entry.valid)?.id||'');}).catch(e=>{if(alive){setBackups([]);setError((e as Error).message);}});return()=>{alive=false;};},[connection.url,connection.token,board.root]);
 const valid=(backups||[]).filter(entry=>entry.valid);
 return <div className="modal-backdrop"><section ref={dialog} className="board-dialog board-restore" role="dialog" aria-modal="true" aria-label={l('Restore board','Откат доски')}>
  <h2>{l('Restore an earlier snapshot','Откатить доску к сохранённой версии')}</h2>
  <p>{l('Pocket Code keeps private copies of this board on the PC. The current file is saved as one more copy before it is replaced, so a restore can be undone.','Pocket Code хранит на ПК личные копии этой доски. Перед заменой текущий файл тоже сохраняется как копия, поэтому откат можно отменить.')}</p>
  {backups===null?<p role="status">{l('Loading snapshots…','Загружаем копии…')}</p>:!valid.length?<p>{l('No good snapshot is stored for this board yet.','Исправных копий этой доски пока нет.')}</p>:
   <ul className="board-restore-list">{valid.map(entry=><li key={entry.id}><label><input type="radio" name="board-backup" checked={selected===entry.id} onChange={()=>setSelected(entry.id)}/><span>{moment(entry.savedAt,ru)}</span><small>{Math.max(1,Math.round(entry.bytes/1024)).toLocaleString(ru?'ru-RU':'en-US')} {l('KB','КБ')}</small></label></li>)}</ul>}
  {error&&<p role="alert">{error}</p>}
  <footer><button type="button" disabled={busy} onClick={onClose}>{l('Cancel','Отмена')}</button><button type="button" className="primary" disabled={busy||!selected} onClick={async()=>{setBusy(true);setError('');try{onBoard(await request<BoardView>(connection,'/project-board/restore',{root:board.root,repositoryRevision:board.repositoryRevision,backup:selected}));onClose();}catch(e){setError((e as Error).message);setBusy(false);}}}>{l('Restore','Откатить')}</button></footer>
 </section></div>;
}

/** Why a board is read-only or close to its limits, with a lossless repair and a rollback to the last good snapshot. */
export function BoardHealth({connection,board,host,onBoard,onReveal}:{connection:Connection;board:BoardView;host:boolean;onBoard(board:BoardView):void;onReveal(id:string):void}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const issues=board.issues||[],errors=issues.filter(issue=>issue.severity==='error'),warnings=issues.filter(issue=>issue.severity==='warning');
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[restoring,setRestoring]=useState(false);
 useEffect(()=>{setError('');},[board.repositoryRevision]);
 if(!errors.length&&!warnings.length&&!notice)return null;
 const unreadable=errors.some(issue=>issue.code==='invalid_json'),repairable=!!errors.length&&!unreadable&&errors.every(issue=>issue.fix),shown=(errors.length?errors:warnings).slice(0,60),ids=new Set([...board.notes.map(note=>note.id),...(board.canvas?.items||[]).map(item=>item.id)]);
 async function repair(){
  if(busy)return;setBusy(true);setError('');
  try{const result=await request<{board:BoardView;fixed:number;history:string[]}>(connection,'/project-board/repair',{root:board.root,repositoryRevision:board.repositoryRevision});onBoard(result.board);setOpen(false);setNotice(l(`Repaired records: ${result.fixed}.`,`Исправлено записей: ${result.fixed}.`)+(result.history.length?' '+l('Removed text is kept in: ','Убранный текст сохранён в: ')+result.history.join(', '):''));}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const headline=errors.length?(unreadable?(board.health?.recovered?l(`The board file is damaged. Showing the last good snapshot of ${moment(board.health.recovered.savedAt,false)}, read-only.`,`Файл доски повреждён. Показана последняя исправная версия от ${moment(board.health.recovered.savedAt,true)}, только для чтения.`):l('The board file is damaged and cannot be read.','Файл доски повреждён и не читается.')):l(`The board is read-only: ${errors.length} record(s) are outside the board format.`,`Доска открыта только для чтения: записей вне формата — ${errors.length}.`)):warnings.length?l(`Close to a limit: ${warnings.length}`,`Близко к лимиту: ${warnings.length}`):'';
 return <section className={'board-health'+(errors.length?' board-health-error':warnings.length?' board-health-warning':' board-health-notice')} aria-label={l('Board health','Состояние доски')}>
  {headline&&<header role={errors.length?'alert':'status'}><TriangleAlert size={16} aria-hidden="true"/><strong>{headline}</strong>
   <span className="board-health-actions">
    {host&&repairable&&<button type="button" className="primary" disabled={busy} onClick={()=>void repair()}><Wrench size={14} aria-hidden="true"/>{busy?l('Repairing…','Чиним…'):l('Repair','Починить')}</button>}
    {host&&!!errors.length&&board.health?.backups&&<button type="button" disabled={busy} onClick={()=>setRestoring(true)}><History size={14} aria-hidden="true"/>{l('Restore…','Откатить…')}</button>}
    <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<ChevronUp size={14} aria-hidden="true"/>:<ChevronDown size={14} aria-hidden="true"/>}{l('Details','Подробнее')}</button>
   </span></header>}
  {errors.length>0&&!open&&<p className="board-health-summary">{issueSubject(errors[0],ru)}: {issueText(errors[0],ru)}{errors.length>1?' '+l(`…and ${errors.length-1} more.`,`…и ещё ${errors.length-1}.`):''}</p>}
  {errors.length>0&&repairable&&!open&&<p className="board-health-hint">{l('Repair keeps every word: text over a limit moves to project-boards/history next to the board, and the current file is saved as a private copy first.','Починка ничего не теряет: текст сверх лимита переносится в project-boards/history рядом с доской, а текущий файл перед этим сохраняется как личная копия.')}</p>}
  {errors.length>0&&!repairable&&!unreadable&&<p className="board-health-hint">{l('Some records cannot be repaired automatically. Correct the file or restore an earlier snapshot.','Часть записей нельзя починить автоматически. Исправьте файл вручную или откатите доску к сохранённой версии.')}</p>}
  {open&&<ul className="board-health-list">{shown.map((issue,index)=><li key={index}><div><strong>{issueSubject(issue,ru)}</strong><span>{issueText(issue,ru)}</span>{issue.fix&&<small>{issueFix(issue,ru)}</small>}<code>{issue.path}{issue.id?' · '+issue.id:''}</code></div>{issue.id&&ids.has(issue.id)&&<button type="button" className="icon-button" aria-label={l('Show on board','Показать на доске')} title={l('Show on board','Показать на доске')} onClick={()=>onReveal(issue.id!)}><Crosshair size={16}/></button>}</li>)}{(errors.length?errors:warnings).length>shown.length&&<li>{l('More records are listed by the board_health MCP tool.','Остальные записи показывает MCP-инструмент board_health.')}</li>}</ul>}
  {notice&&<p className="board-health-done" role="status">{notice} <button type="button" onClick={()=>setNotice('')}>{l('Hide','Скрыть')}</button></p>}
  {error&&<p role="alert" className="board-health-failure">{error}</p>}
  {restoring&&<RestoreDialog connection={connection} board={board} onClose={()=>setRestoring(false)} onBoard={next=>{onBoard(next);setNotice(l('The board was restored from a saved snapshot.','Доска откатана к сохранённой версии.'));}}/>}
 </section>;
}
