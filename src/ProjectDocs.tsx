import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,FileText,RefreshCw} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useBackAction} from './navigation';
import {safeWebUrl} from './RichBlocks';
import {Files} from './Files';
import './project-docs.css';

type ProjectDocument={path:string;name:string;kind:'rules'|'changelog';source:string;appliesTo:'all'|'claude'|'codex';bytes:number};
type DocumentIndex={project:string;documents:ProjectDocument[];truncated:boolean};
type DocumentContent=ProjectDocument&{content:string};
type Props={connection:Connection;root:string;provider?:'claude'|'codex';onProject:(path:string)=>void};
const labels={
  rules:['Rules','Правила'],changelog:['Changelog','История изменений'],files:['Files','Файлы'],tabs:['Project sections','Разделы проекта'],back:['Back to documents','К документам'],
  refresh:['Refresh documents','Обновить документы'],refreshDocument:['Refresh document','Обновить документ'],
  loading:['Loading documents…','Загружаем документы…'],reading:['Loading document…','Загружаем документ…'],
  updating:['Refreshing…','Обновляем…'],retry:['Try again','Повторить'],all:['Shared','Общие'],
  note:['Rule files from this project on the PC.','Файлы правил выбранного проекта на ПК.'],filesNote:['Project files, shown as saved on the PC.','Файлы проекта в том виде, как они сохранены на ПК.'],
  emptyRules:['No project rules found.','Правила проекта пока не найдены.'],emptyChangelog:['No changelog found.','Журнал изменений пока не найден.'],
  rulePaths:['Recognized files: AGENTS.md, AGENTS.override.md, CLAUDE.md, CLAUDE.local.md, RULES.md, and Markdown files in rules, .claude/rules, .codex/rules or .agents/rules.','Поддерживаются AGENTS.md, AGENTS.override.md, CLAUDE.md, CLAUDE.local.md, RULES.md и Markdown-файлы в rules, .claude/rules, .codex/rules или .agents/rules.'],
  changelogPaths:['Project changelogs named CHANGELOG.md, CHANGES.md or HISTORY.md, including supported docs/ variants, appear here.','Здесь отображаются журналы CHANGELOG.md, CHANGES.md или HISTORY.md проекта, в том числе поддерживаемые варианты в docs/.'],
  noProject:['Choose a project to view its rules and changelog.','Выберите проект, чтобы посмотреть его правила и изменения.'],
  listError:['Could not refresh documents.','Не удалось обновить документы.'],documentError:['Could not refresh this document.','Не удалось обновить документ.'],
  lastCopy:['The last loaded copy remains below.','Ниже остаётся последняя загруженная версия.'],
  emptyDocument:['This document is empty.','Этот документ пока пуст.'],
  truncated:['Some documents are not listed because the project limit was reached.','Показаны не все документы: достигнут лимит проекта.'],
  attachment:['Open image link','Открыть ссылку на изображение'],details:['Connection details','Подробности подключения'],
} as const;
type Label=keyof typeof labels;

export function ProjectDocs(props:Props){
  const language=useLanguage();
  const label=(key:Label)=>labels[key][language==='ru'?1:0];
  if(!props.root)return <section className="project-docs"><p className="project-docs-empty">{label('noProject')}</p></section>;
  // Remounting on project/host changes prevents even one frame of another
  // project's document and isolates all requests and navigation state.
  return <ProjectDocuments key={`${props.connection.url}\0${props.connection.token}\0${props.root}`} {...props} label={label}/>;
}

function ProjectDocuments({connection,root,onProject,label}:Props&{label:(key:Label)=>string}){
  const [kind,setKind]=useState<'rules'|'changelog'|'files'>('rules');
  const [index,setIndex]=useState<DocumentIndex|null>(null),[loading,setLoading]=useState(true),[listError,setListError]=useState('');
  const [indexRevision,setIndexRevision]=useState(0),[selected,setSelected]=useState<ProjectDocument|null>(null);
  const [document,setDocument]=useState<DocumentContent|null>(null),[reading,setReading]=useState(false),[documentError,setDocumentError]=useState('');
  const refreshDocument=useRef<()=>void>(()=>{});
  const scroller=useRef<HTMLElement|null>(null),listScroll=useRef(0),documentHeading=useRef<HTMLHeadingElement|null>(null);
  const returnFocus=useRef<HTMLButtonElement|null>(null),returnPath=useRef(''),focusBack=useRef(false);
  const cwd=`cwd=${encodeURIComponent(root)}`;
  function goBack(){setSelected(null);focusBack.current=true;}
  useBackAction(()=>{goBack();return true;},20,Boolean(selected));

  useEffect(()=>{
    let cancelled=false;setLoading(true);setListError('');
    request<DocumentIndex>(connection,`/project-docs?${cwd}`).then(value=>{if(!cancelled)setIndex(value);}).catch(error=>{if(!cancelled)setListError(error.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[connection,cwd,indexRevision]);
  useEffect(()=>{
    if(!selected){setDocument(null);setDocumentError('');setReading(false);refreshDocument.current=()=>{};return;}
    let cancelled=false,inFlight=false;setDocument(null);setDocumentError('');
    async function load(){
      if(cancelled||inFlight)return;inFlight=true;setReading(true);
      try{const value=await request<DocumentContent>(connection,`/project-doc?${cwd}&path=${encodeURIComponent(selected!.path)}`);if(!cancelled){setDocument(value);setDocumentError('');}}
      catch(error){if(!cancelled)setDocumentError((error as Error).message);}
      finally{inFlight=false;if(!cancelled)setReading(false);}
    }
    refreshDocument.current=()=>{void load();};void load();
    const timer=window.setInterval(()=>{if(globalThis.document.visibilityState!=='hidden')void load();},15000);
    return()=>{cancelled=true;window.clearInterval(timer);refreshDocument.current=()=>{};};
  },[connection,cwd,selected?.path]);
  useEffect(()=>{
    if(selected){scroller.current?.scrollTo({top:0});documentHeading.current?.focus({preventScroll:true});}
    else if(focusBack.current){focusBack.current=false;if(scroller.current)scroller.current.scrollTop=listScroll.current;returnFocus.current?.focus({preventScroll:true});}
  },[selected]);
  const documents=index?.documents.filter(item=>item.kind===kind)||[];
  const appliesTo=(item:ProjectDocument)=>item.appliesTo==='all'?label('all'):item.appliesTo==='codex'?'Codex':'Claude';
  const failure=(message:string,kind:'list'|'document',saved:boolean)=><div className="project-docs-error" role="alert"><p>{label(kind==='list'?'listError':'documentError')}{saved?` ${label('lastCopy')}`:''}</p><details><summary>{label('details')}</summary><p>{message}</p></details><button className="secondary" disabled={kind==='list'?loading:reading} onClick={()=>kind==='list'?setIndexRevision(value=>value+1):refreshDocument.current()}>{label('retry')}</button></div>;

  return <section className="project-docs" ref={scroller} aria-label={selected?.name||label(kind)}>
    <div className="project-docs-toolbar">
      {selected?<button className="text-button" onClick={goBack}><ArrowLeft size={18}/>{label('back')}</button>:<><p className="project-docs-root">{root}</p><div className="project-docs-tabs" role="tablist" aria-label={label('tabs')}>{(['rules','changelog','files'] as const).map(value=><button role="tab" key={value} id={`project-tab-${value}`} tabIndex={kind===value?0:-1} aria-selected={kind===value} aria-controls="project-documents-list" className={kind===value?'active':''} onKeyDown={event=>{const tabs=['rules','changelog','files'] as const,index=tabs.indexOf(value),next=event.key==='Home'?0:event.key==='End'?2:event.key==='ArrowRight'?(index+1)%3:event.key==='ArrowLeft'?(index+2)%3:null;if(next!==null){event.preventDefault();setKind(tabs[next]);globalThis.document.getElementById(`project-tab-${tabs[next]}`)?.focus();}}} onClick={()=>{setKind(value);if(scroller.current)scroller.current.scrollTop=0;}}>{label(value)}</button>)}</div></>}
      {kind!=='files'&&<button className="icon-button" aria-label={label(selected?'refreshDocument':'refresh')} disabled={selected?reading:loading} onClick={()=>selected?refreshDocument.current():setIndexRevision(value=>value+1)}><RefreshCw size={18} className={(selected?reading:loading)?'project-docs-refreshing':''}/></button>}
    </div>
    {selected?<article className="project-document">
      {selected.path!==selected.name&&<p className="project-docs-path">{selected.path}</p>}<h2 ref={documentHeading} tabIndex={-1}>{selected.name}</h2>
      <p className="project-docs-meta">{selected.kind==='rules'?appliesTo(selected):label('changelog')}{reading&&document?` · ${label('updating')}`:''}</p>
      {documentError&&failure(documentError,'document',Boolean(document))}
      {reading&&!document&&<p role="status">{label('reading')}</p>}
      {document&&(document.content.trim()?<div className="markdown project-docs-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({href,children})=>safeWebUrl(href)?<a href={safeWebUrl(href)!} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>,img:({src,alt})=>safeWebUrl(typeof src==='string'?src:undefined)?<a className="project-docs-image-link" href={safeWebUrl(src as string)!} target="_blank" rel="noopener noreferrer">{label('attachment')}{alt?` · ${alt}`:''}</a>:<span>📎 {alt||label('attachment')}</span>}}>{document.content}</ReactMarkdown></div>:<p className="project-docs-empty">{label('emptyDocument')}</p>)}
    </article>:kind==='files'?<div className="project-docs-files" id="project-documents-list" role="tabpanel" aria-labelledby="project-tab-files"><Files connection={connection} root={root} onProject={onProject}/></div>:<div id="project-documents-list" role="tabpanel" aria-labelledby={`project-tab-${kind}`}>
      <p className="project-docs-note">{label(kind==='rules'?'note':'filesNote')}</p>
      {listError&&failure(listError,'list',Boolean(index))}
      {loading&&!index&&<p role="status">{label('loading')}</p>}
      {index?.truncated&&<p className="project-docs-limit" role="status">{label('truncated')}</p>}
      <div className="project-docs-list">{documents.map(item=><button key={item.path} ref={element=>{if(item.path===returnPath.current)returnFocus.current=element;}} className="project-docs-item" onClick={event=>{listScroll.current=scroller.current?.scrollTop||0;returnPath.current=item.path;returnFocus.current=event.currentTarget;setSelected(item);}}>{item.kind==='rules'?<BookOpen size={20} aria-hidden="true"/>:<FileText size={20} aria-hidden="true"/>}<span><strong>{item.name}</strong>{item.path!==item.name&&<span>{item.path}</span>}<small>{item.kind==='rules'?`${appliesTo(item)} · `:''}{item.source}</small></span></button>)}</div>
      {!loading&&!listError&&!documents.length&&<div className="project-docs-empty"><h3>{label(kind==='rules'?'emptyRules':'emptyChangelog')}</h3><p>{label(kind==='rules'?'rulePaths':'changelogPaths')}</p></div>}
    </div>}
  </section>;
}
