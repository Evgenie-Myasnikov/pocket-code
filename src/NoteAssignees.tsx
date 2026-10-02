import {useEffect,useRef,useState} from 'react';
import {Plus,X} from 'lucide-react';
import type {BoardNote} from '../server/boards';
import type {BoardPerson} from './BoardPeople';
import {useLanguage} from './i18n';
import './note-assignees.css';

export function assigneeIds(note:BoardNote){return [...new Set(note.assigneeIds??(note.assigneeId?[note.assigneeId]:note.owner?['legacy:'+note.owner]:[]))];}
export function withAssignees(note:BoardNote,ids:string[],people:BoardPerson[]):BoardNote{
  const first=people.find(p=>p.id===ids[0]);return {...note,assigneeIds:ids,assigneeId:first&&!first.id.startsWith('legacy:')?first.id:'',owner:first?.name||''};
}
export function avatarColor(id:string){let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);return `hsl(${(hash>>>0)%360} 48% 32%)`;}
export function PersonAvatar({person}:{person:BoardPerson}){return <span className="person-avatar" style={{background:avatarColor(person.id)}} title={person.name} aria-label={person.name}>{Array.from(person.name.trim())[0]?.toLocaleUpperCase()||'?'}</span>;}
export function NoteAssignees({note,people,onChange,disabled=false}:{note:BoardNote;people:BoardPerson[];onChange?(ids:string[]):void;disabled?:boolean}){
  const ru=useLanguage()==='ru',[open,setOpen]=useState(false),[search,setSearch]=useState('');const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),ids=assigneeIds(note);
  const label=ru?'Добавить участника':'Add participant';
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  return <div className="note-assignees" aria-label={ru?'Участники заметки':'Note participants'}>
    {ids.map(id=>{const person=people.find(p=>p.id===id)||{id,name:ru?'Участник':'Participant'};return <span className="assignee-chip" key={id}><PersonAvatar person={person}/>{onChange&&<button type="button" className="assignee-remove" disabled={disabled} aria-label={(ru?'Убрать ':'Remove ')+person.name} title={(ru?'Убрать ':'Remove ')+person.name} onClick={()=>onChange(ids.filter(v=>v!==id))}><X size={10}/></button>}</span>;})}
    {onChange&&<button ref={trigger} type="button" className="assignee-add" disabled={disabled} aria-label={label} title={label} onClick={()=>{setSearch('');setOpen(true);}}><Plus size={18}/></button>}
    <dialog ref={dialog} className="assignee-picker" aria-label={label} onCancel={()=>setOpen(false)} onClose={()=>{setOpen(false);trigger.current?.focus();}}>
      <header><h3>{label}</h3><button type="button" className="icon-button" aria-label={ru?'Закрыть':'Close'} onClick={()=>setOpen(false)}><X size={20}/></button></header>
      <input autoFocus aria-label={ru?'Найти участника':'Find participant'} placeholder={ru?'Имя участника':'Participant name'} value={search} onChange={e=>setSearch(e.target.value)}/>
      <ul>{people.filter(p=>!ids.includes(p.id)&&p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(p=><li key={p.id}><button type="button" disabled={disabled} onClick={()=>{onChange?.([...ids,p.id]);setOpen(false);}}><PersonAvatar person={p}/><span>{p.name}</span></button></li>)}</ul>
      {!people.some(p=>!ids.includes(p.id)&&p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))&&<p className="muted">{ru?'Нет доступных участников':'No available participants'}</p>}
    </dialog>
  </div>;
}
