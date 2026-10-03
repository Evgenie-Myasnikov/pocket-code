import {useEffect,useState} from 'react';
import {BookOpen,FileText,RefreshCw} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {ProjectDocs} from './ProjectDocs';
import './project-docs.css';

type Project={root:string;name:string;documents:{path:string}[]};
export function DocumentLibrary({connection,kind}:{connection:Connection;kind:'rules'|'changelog'}){
 const ru=useLanguage()==='ru',l=(en:string,other:string)=>ru?other:en;
 const [projects,setProjects]=useState<Project[]>([]),[root,setRoot]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let cancelled=false;setLoading(true);setError('');request<Project[]>(connection,'/document-projects?kind='+kind).then(items=>{if(cancelled)return;setProjects(items);setRoot(old=>items.some(item=>item.root===old)?old:items[0]?.root||'');}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[connection.url,connection.token,kind,revision]);
 const Icon=kind==='rules'?BookOpen:FileText;
 return <section className="document-library">
  <div className="document-library-context"><Icon size={20}/><label><span>{l('Git project','Git-проект')}</span><select aria-label={l('Git project','Git-проект')} disabled={!projects.length} value={root} onChange={e=>setRoot(e.target.value)}>{!projects.length&&<option value="">{loading?l('Finding projects…','Ищем проекты…'):l('No matching projects','Нет подходящих проектов')}</option>}{projects.map(p=><option key={p.root} value={p.root}>{p.name}{projects.filter(v=>v.name===p.name).length>1?' · '+p.root:''}</option>)}</select></label><button className="icon-button" aria-label={l('Refresh projects','Обновить проекты')} disabled={loading} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={19}/></button></div>
  {error&&<p className="error" role="alert">{error}</p>}
  {!loading&&!error&&!projects.length&&<p className="document-library-empty">{kind==='changelog'?l('Git projects containing CHANGELOG.md, CHANGES.md or HISTORY.md appear here.','Здесь появятся Git-проекты с CHANGELOG.md, CHANGES.md или HISTORY.md.'):l('Git projects with Markdown rules appear here.','Здесь появятся Git-проекты с правилами в Markdown.')}</p>}
  {root&&<ProjectDocs key={kind+root} connection={connection} root={root} category={kind} hideRefresh refreshRevision={revision} onProject={()=>{}}/>}
 </section>;
}
