import {useEffect,useId,useMemo,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,ChevronRight,Folder,FolderOpen,Search,X} from 'lucide-react';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import {filterProjectFolders,projectFolderTree,type ProjectFolder} from './project-folder-tree';
import './project-folder-picker.css';

export type ProjectFolderPickerProps={
  paths:readonly string[];value:string;onChange(path:string):void;label:string;
  disabled?:boolean;placeholder?:string;className?:string;allowClear?:boolean;
  descriptionForPath?(path:string):string|undefined;
  displayNameForPath?(path:string):string|undefined;
};

const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
const byName=(a:ProjectFolder,b:ProjectFolder)=>collator.compare(a.name,b.name)||a.name.localeCompare(b.name);

export function ProjectFolderDialog({paths,value,onChange,label,allowClear,descriptionForPath,displayNameForPath,onClose}:
  ProjectFolderPickerProps&{onClose():void}){
  const ru=useLanguage()==='ru',titleId=useId();
  const tree=useMemo(()=>projectFolderTree(paths),[paths]);
  const [trail,setTrail]=useState<string[]>(()=>ancestors(tree.start).map(node=>node.name));
  const [query,setQuery]=useState('');
  const panel=useRef<HTMLElement>(null),search=useRef<HTMLInputElement>(null),rows=useRef<HTMLDivElement>(null);
  useModal(panel,true,onClose);
  const nodes=[tree.root];
  for(const segment of trail){const node=Array.from(nodes[nodes.length-1].children.values()).find(node=>node.name===segment);if(!node)break;nodes.push(node);}
  const folder=nodes[nodes.length-1],searching=Boolean(query.trim());
  const entries=(searching?filterProjectFolders(tree.projects,query,displayNameForPath):Array.from(folder.children.values())).sort(byName);
  const viewKey=JSON.stringify([trail,query]);
  useEffect(()=>{if(rows.current)rows.current.scrollTop=0;},[viewKey]);
  function ancestors(node:ProjectFolder){
    const list:ProjectFolder[]=[];
    for(let parent:ProjectFolder|undefined=node;parent?.parent;parent=parent.parent)list.unshift(parent);
    return list;
  }
  function browse(node:ProjectFolder){
    setQuery('');setTrail(ancestors(node).map(item=>item.name));
    requestAnimationFrame(()=>rows.current?.focus({preventScroll:true}));
  }
  function choose(path:string){
    onChange(path);onClose();
  }
  function navigate(event:KeyboardEvent<HTMLElement>){
    const target=event.target;
    if(target===search.current&&event.key==='ArrowDown'){
      const first=rows.current?.querySelector('button');if(first){event.preventDefault();first.focus();}
      return;
    }
    if(!(target instanceof HTMLElement)||!rows.current?.contains(target))return;
    const buttons=Array.from(rows.current.querySelectorAll('button'));
    const pos=buttons.indexOf(target as HTMLButtonElement);
    if(event.key==='ArrowLeft'&&folder.parent&&!searching){event.preventDefault();browse(folder.parent);return;}
    if(event.key==='ArrowRight'){
      const into=target.closest('.project-folder-row')?.querySelector<HTMLButtonElement>('[data-folder-open]');if(into){event.preventDefault();into.click();}return;
    }
    const key=event.key;
    if(!['Home','End','ArrowDown','ArrowUp'].includes(key)||!buttons.length)return;
    event.preventDefault();
    const next=key==='Home'?0:key==='End'?buttons.length-1:key==='ArrowDown'?Math.min(pos+1,buttons.length-1):Math.max(0,pos-1);
    buttons[next].focus();
  }
  function projectButton(node:ProjectFolder){
    const path=node.project!,name=displayNameForPath?.(path)||node.name,description=descriptionForPath?.(path);
    return <button className="project-folder-choice" type="button" aria-label={path} title={path}
      aria-pressed={path===value} onClick={()=>choose(path)}>
      <Folder size={18} aria-hidden="true"/><span><strong>{name}</strong>
        {searching&&<small>{path}</small>}{description&&<small>{description}</small>}
      </span>{path===value&&<Check size={16} aria-hidden="true"/>}
    </button>;
  }
  return createPortal(<div className="modal-backdrop project-folder-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section ref={panel} className="project-folder-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={navigate}>
      <header><h2 id={titleId}>{label}</h2><button type="button" className="icon-button" aria-label={ru?'Закрыть':'Close'} onClick={onClose}><X size={19}/></button></header>
      <label className="project-folder-search"><Search size={17} aria-hidden="true"/><input ref={search} type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={ru?'Поиск по имени или пути':'Search by name or path'} aria-label={ru?'Найти проект':'Find a project'}/></label>
      {!searching&&<nav className="project-folder-crumbs" aria-label={ru?'Путь к папке':'Folder path'}>{nodes.map((node,index)=><span key={index}>
        {index>0&&<ChevronRight size={13} aria-hidden="true"/>}
        <button type="button" aria-current={node===folder?'location':undefined} onClick={()=>browse(node)}>{node.name||(ru?'Все проекты':'All projects')}</button>
      </span>)}</nav>}
      <div ref={rows} className="project-folder-rows" tabIndex={-1} aria-label={ru?'Папки проектов':'Project folders'}>
        {!searching&&folder.project&&<div className="project-folder-row">{projectButton(folder)}</div>}
        {entries.map(node=><div key={node.project||node.name} className="project-folder-row">
          {node.project&&projectButton(node)}
          {!searching&&node.children.size>0&&<button type="button" className={node.project?'project-folder-into':'project-folder-choice'}
            data-folder-open aria-label={(ru?'Открыть папку ':'Open folder ')+node.name} onClick={()=>browse(node)}>
            {!node.project&&<><FolderOpen size={18} aria-hidden="true"/><span>{node.name}</span></>}<ChevronRight size={17} aria-hidden="true"/>
          </button>}
        </div>)}
        {!entries.length&&(searching||!folder.project)&&<p className="muted">{searching?(ru?'Проекты не найдены':'No matching projects'):(ru?'Нет доступных проектов':'No available projects')}</p>}
      </div>
      {allowClear&&value&&<footer><button type="button" className="text-button" onClick={()=>choose('')}>{ru?'Сбросить выбор':'Clear selection'}</button></footer>}
    </section>
  </div>,document.body);
}

export function ProjectFolderPicker(props:ProjectFolderPickerProps){
  const [open,setOpen]=useState(false),ru=useLanguage()==='ru';
  const trigger=useRef<HTMLButtonElement>(null);
  const path=props.value,name=props.displayNameForPath?.(path)||path.split(/[\\/]/).filter(Boolean).at(-1)||path;
  function close(){
    const original=trigger.current;
    setOpen(false);
    // Some pages remount their filters with the newly selected project.
    requestAnimationFrame(()=>{
      if(!original?.isConnected&&document.activeElement===document.body){
        const candidates=document.querySelectorAll<HTMLButtonElement>('button.project-folder-trigger:not(:disabled)');
        Array.from(candidates).find(button=>button.getAttribute('aria-label')===props.label&&button.getClientRects().length&&!button.closest('[inert]'))?.focus({preventScroll:true});
      }
    });
  }
  return <><button ref={trigger} type="button" className={'project-folder-trigger '+(props.className||'')} aria-label={props.label}
    title={path||props.label} disabled={props.disabled} aria-haspopup="dialog" aria-expanded={open}
    onClick={()=>setOpen(true)}><Folder size={16} aria-hidden="true"/><span>{name||props.placeholder||(ru?'Выбрать проект':'Choose project')}</span><ChevronDown size={14} aria-hidden="true"/></button>
    {open&&!props.disabled&&<ProjectFolderDialog {...props} onClose={close}/>}</>;
}
