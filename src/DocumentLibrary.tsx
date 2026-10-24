import {useEffect,useState,useRef} from 'react';
import {BookOpen,FileText,FolderOpen,RefreshCw,ChevronRight} from 'lucide-react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {ProjectDocs} from './ProjectDocs';
import {Files} from './Files';
import './project-docs.css';

export type DocumentKind='rules'|'changelog'|'files';
type Project={root:string;name:string;documents:{path:string}[];builtInOnly?:boolean};
const segments=(root:string)=>root.split(/[\\/]/).filter(Boolean);
/** Same-named projects are told apart by the nearest parent folder that differs, not the full Windows path. */
export function projectLabels(projects:Project[]){
  const labels=new Map<string,string>();
  for(const project of projects){
    const twins=projects.filter(item=>item.name===project.name&&item.root!==project.root);
    if(!twins.length){labels.set(project.root,project.name);continue;}
    const own=segments(project.root);let label='';
    for(let depth=2;depth<=own.length;depth++){const mine=own.at(-depth)!;if(twins.every(item=>segments(item.root).at(-depth)!==mine)){label=mine;break;}}
    labels.set(project.root,project.name+' · '+(label||project.root));
  }
  return labels;
}
/** Rules, Changelog and Files share one project picker; the reader replaces the page title with a file breadcrumb. */
export function DocumentLibrary({connection,kind,showHeading,onKind,onChat,onFolderChat}:{connection:Connection;kind:DocumentKind;showHeading?:boolean;onKind?(kind:DocumentKind):void;onChat?(root:string,prompt:string):void;onFolderChat?(path:string):void}){
 useLanguage();
 const [view,setView]=useState<DocumentKind>(kind);
 const section=useRef<DocumentKind>(kind==='files'?'rules':kind);
 if(kind!=='files')section.current=kind;
 useEffect(()=>{setView(kind);},[kind]);
 const [projects,setProjects]=useState<Project[]>([]),[root,setRoot]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[reading,setReading]=useState('');
 useEffect(()=>{let cancelled=false;setLoading(true);setError('');request<Project[]>(connection,'/document-projects?kind='+view).then(items=>{if(cancelled)return;setProjects(items);setRoot(old=>items.some(item=>item.root===old)?old:items.find(item=>!item.builtInOnly)?.root||items[0]?.root||'');}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[connection.url,connection.token,view,revision]);
 useEffect(()=>{setReading('');},[root,view]);
 const labels=projectLabels(projects),authored=projects.filter(item=>!item.builtInOnly),builtInOnly=projects.filter(item=>item.builtInOnly);
 const option=(p:Project)=><option key={p.root} value={p.root}>{labels.get(p.root)}</option>;
 const choose=(next:DocumentKind)=>{setView(next);onKind?.(next);};
 const tabs:[DocumentKind,string,typeof BookOpen][]=[['rules',t('Правила'),BookOpen],['changelog',t('История изменений'),FileText],['files',t('Файлы'),FolderOpen]];
 return <section className={'document-library'+(reading?' reading':'')}>
  {showHeading&&!reading&&<header className="document-section-heading"><h1>{tabs.find(([id])=>id===view)![1]}</h1></header>}

  <div className="document-library-context">
   <button className="icon-button" aria-label={view==='files'?t('Назад'):t('Файлы')} onClick={()=>choose(view==='files'?section.current:'files')}><FolderOpen size={16}/></button>
   <label><span className="visually-hidden">{t('Git-проект')}</span><select aria-label={t('Git-проект')} disabled={!projects.length} value={root} onChange={e=>setRoot(e.target.value)}>{!projects.length&&<option value="">{loading?t('Ищем проекты…'):t('Нет подходящих проектов')}</option>}{builtInOnly.length&&authored.length?<><optgroup label={t('С правилами проекта')}>{authored.map(option)}</optgroup><optgroup label={t('Только встроенное правило')}>{builtInOnly.map(option)}</optgroup></>:projects.map(option)}</select></label>
   {reading&&<span className="document-library-crumb" aria-label={t('Открытый файл')}><ChevronRight size={16} aria-hidden="true"/><span>{reading}</span></span>}
   {view==='files'&&<button className="icon-button" aria-label={t('Обновить список проектов')} disabled={loading} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={20} className={loading?'project-docs-refreshing':''}/></button>}
  </div>
  {error&&<div className="project-docs-error document-library-error" role="alert"><p>{t('Не удалось получить список проектов.')}</p><details><summary>{t('Подробности')}</summary><p>{t(error)}</p></details><button className="secondary" disabled={loading} onClick={()=>setRevision(v=>v+1)}>{t('Повторить')}</button></div>}
  {!loading&&!error&&!projects.length&&<p className="document-library-empty">{view==='changelog'?t('Здесь появятся Git-проекты с CHANGELOG.md, CHANGES.md или HISTORY.md.'):view==='files'?t('Здесь появятся Git-проекты с этого ПК.'):t('Здесь появятся Git-проекты с правилами в Markdown.')}</p>}
  {root&&(view==='files'?<div className="project-docs document-library-files"><Files key={root} connection={connection} root={root} onProject={onFolderChat}/></div>
   :<ProjectDocs key={view+root} connection={connection} root={root} category={view} refreshRevision={revision} onRefreshProjects={()=>setRevision(v=>v+1)} onChat={onChat} onReading={setReading}/>)}
 </section>;
}
