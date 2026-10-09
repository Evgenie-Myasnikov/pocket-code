import {NoteAssignees,PersonAvatar,assigneeIds} from './NoteAssignees';
import type {BoardNote,ProjectWorkspace} from '../server/boards';
import {useLanguage} from './i18n';

export const priorityLabels={critical:['Critical','Критический'],high:['High','Высокий'],normal:['Normal','Обычный'],low:['Low','Низкий']} as const;
const rank={critical:0,high:1,normal:2,low:3};
export type BoardPerson={id:string;name:string;role?:string};
export function boardPeople(workspace:ProjectWorkspace|undefined,notes:BoardNote[]):BoardPerson[]{
  const people:BoardPerson[]=[...(workspace?.people||[...(workspace?.members||[])])];
  for(const n of notes)for(const id of assigneeIds(n)){if(id&&!people.some(p=>p.id===id))people.push({id,name:id==='host'?'Participant':n.assigneeId===id?n.owner||'Participant':id.startsWith('legacy:')?id.slice(7):'Participant'});}
  return people;
}
export function notesForPerson(notes:BoardNote[],id:string){return notes.filter(n=>(id?assigneeIds(n).includes(id):!assigneeIds(n).length)).sort((a,b)=>rank[a.priority||'normal']-rank[b.priority||'normal']||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));}
export function BoardTaskMeta({note,status}:{note:BoardNote;status:string}){
  const ru=useLanguage()==='ru',priority=note.priority||'normal';
  return <span className="board-task-meta"><span className={'task-priority priority-'+priority}>{priorityLabels[priority][ru?1:0]}</span><span className={'task-status status-'+note.status}>{status}</span></span>;
}
export function BoardPeople({notes,people,statusLabels,onOpen,onAssign,disabled}:{notes:BoardNote[];people:BoardPerson[];statusLabels:Record<string,string>;onOpen(note:BoardNote):void;onAssign?(note:BoardNote,ids:string[]):void;disabled?:boolean}){
  const ru=useLanguage()==='ru';
  return <div className="board-people" aria-label={ru?'Задачи по людям':'Tasks by person'}>{[...people,{id:'',name:ru?'Не назначено':'Unassigned'}].map(person=>{
    const tasks=notesForPerson(notes,person.id),name=person.name;
    return <section className="board-person" key={person.id} aria-label={name}><header>{person.id&&<PersonAvatar person={person}/>}<h3>{name}</h3><span>{tasks.length}</span></header>{!tasks.length?<p className="muted">{ru?'Нет задач':'No tasks'}</p>:<ul>{tasks.map(note=><li key={note.id}><button className="people-task" onClick={()=>onOpen(note)}><strong>{note.title}</strong><BoardTaskMeta note={note} status={statusLabels[note.status]}/></button><NoteAssignees note={note} people={people} disabled={disabled} onChange={onAssign?ids=>onAssign(note,ids):undefined}/></li>)}</ul>}</section>;
  })}</div>;
}
