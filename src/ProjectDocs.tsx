import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,BookOpen,FileText,RefreshCw,Folder,ChevronRight} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useBackAction} from './navigation';
import {safeWebUrl} from './RichBlocks';
import {Files} from './Files';
import './project-docs.css';

type ProjectDocument={path:string;name:string;kind:'rules'|'changelog';source:string;appliesTo:'all'|'claude'|'codex'|'copilot';bytes:number};
type DocumentIndex={project:string;documents:ProjectDocument[];truncated:boolean};
type DocumentContent=ProjectDocument&{content:string};
type Props={roots?:string[];onSelectProject?(root:string):void;connection:Connection;root:string;provider?:'claude'|'codex'|'copilot';onProject:(path:string)=>void};
const labels={
  projectFolder:['Project folder','Папка проекта'],
  overview:['Project overview','Обзор проекта'],location:['Project folder','Расположение проекта'],rootLabel:['Project root','Корень проекта'],browse:['Browse folders and open files','Папки и просмотр файлов'],ruleHelp:['Instructions for AI in this project','Инструкции для AI в этом проекте'],historyHelp:['Read the project change history','Посмотреть историю изменений проекта'],
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

function ProjectDocuments({connection,root,roots,onSelectProject,onProject,label}:Props&{label:(key:Label)=>string}){
  const [kind,setKind]=useState<'overview'|'rules'|'changelog'|'files'>('overview');
  const [index,setIndex]=useState<DocumentIndex|null>(null),[loading,setLoading]=useState(true),[listError,setListError]=useState('');
  const [indexRevision,setIndexRevision]=useState(0),[selected,setSelected]=useState<ProjectDocument|null>(null);
  const [document,setDocument]=useState<DocumentContent|null>(null),[reading,setReading]=useState(false),[documentError,setDocumentError]=useState('');
  const refreshDocument=useRef<()=>void>(()=>{});
  const scroller=useRef<HTMLElement|null>(null),listScroll=useRef(0),documentHeading=useRef<HTMLElement|null>(null);
  const returnFocus=useRef<HTMLButtonElement|null>(null),returnPath=useRef(''),focusBack=useRef(false);
  const pendingAutoOpen=useRef(false),directDocument=useRef(false),lastCategory=useRef(''),overviewFocus=useRef(false);
  const categoryButtons=useRef<Record<string,HTMLButtonElement|null>>({});
  const cwd=`cwd=${encodeURIComponent(root)}`;
  function showOverview(){pendingAutoOpen.current=false;directDocument.current=false;overviewFocus.current=true;setSelected(null);setKind('overview');}
  function goBack(){if(directDocument.current){showOverview();return;}setSelected(null);focusBack.current=true;}
  function openCategory(value:'rules'|'changelog'|'files'){lastCategory.current=value;directDocument.current=false;pendingAutoOpen.current=value!=='files';setKind(value);}
  useBackAction(()=>{if(selected)goBack();else showOverview();return true;},20,Boolean(selected)||kind!=='overview');

  useEffect(()=>{
    let cancelled=false;setLoading(true);setListError('');
    request<DocumentIndex>(connection,`/project-docs?${cwd}`).then(value=>{if(!cancelled)setIndex(value);}).catch(error=>{if(!cancelled)setListError(error.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[connection,cwd,indexRevision]);
  useEffect(()=>{
    if(!pendingAutoOpen.current||!index||loading||listError||kind==='overview'||kind==='files')return;
    pendingAutoOpen.current=false;
    const matches=index.documents.filter(item=>item.kind===kind);
    if(matches.length===1&&!index.truncated){directDocument.current=true;setSelected(matches[0]);}
  },[index,loading,listError,kind]);
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
    if(kind==='overview'&&overviewFocus.current){overviewFocus.current=false;categoryButtons.current[lastCategory.current]?.focus({preventScroll:true});}
    else if(selected){scroller.current?.scrollTo({top:0});documentHeading.current?.focus({preventScroll:true});}
    else if(focusBack.current){focusBack.current=false;if(scroller.current)scroller.current.scrollTop=listScroll.current;returnFocus.current?.focus({preventScroll:true});}
  },[selected,kind]);
  const documents=index?.documents.filter(item=>item.kind===kind)||[];
  const appliesTo=(item:ProjectDocument)=>item.appliesTo==='all'?label('all'):item.appliesTo==='codex'?'Codex':'Claude';
  const failure=(message:string,kind:'list'|'document',saved:boolean)=><div className="project-docs-error" role="alert"><p>{label(kind==='list'?'listError':'documentError')}{saved?` ${label('lastCopy')}`:''}</p><details><summary>{label('details')}</summary><p>{message}</p></details><button className="secondary" disabled={kind==='list'?loading:reading} onClick={()=>kind==='list'?setIndexRevision(value=>value+1):refreshDocument.current()}>{label('retry')}</button></div>;

  if(kind==='overview')return <section className="project-docs project-overview" aria-label={label('overview')}>
    <label className="project-context-picker"><span>{label('projectFolder')}</span><select aria-label={label('projectFolder')} value={root} onChange={event=>onSelectProject?.(event.target.value)}>{[...new Set([root,...roots||[]])].map(folder=><option key={folder} value={folder}>{folder.split(/[\\/]/).filter(Boolean).pop()||folder}</option>)}</select></label>
    <div className="project-overview-cards">{(['files','rules','changelog'] as const).map(value=>{const Icon=value==='files'?Folder:value==='rules'?BookOpen:FileText;return <button key={value} ref={button=>{categoryButtons.current[value]=button;}} className="project-overview-card" onClick={()=>openCategory(value)}><Icon size={24}/><span><strong>{label(value)}</strong><small>{label(value==='files'?'browse':value==='rules'?'ruleHelp':'historyHelp')}</small></span><ChevronRight size={18}/></button>;})}</div>
  </section>;
  return <section className="project-docs" ref={scroller} aria-label={selected?.name||label(kind)}>
    <div className="project-docs-toolbar">
      <button className="text-button project-overview-back" onClick={selected?goBack:showOverview}><ArrowLeft size={18}/>{label(selected&&!directDocument.current?'back':'overview')}</button>
      {kind!=='files'&&<button className="icon-button" aria-label={label(selected?'refreshDocument':'refresh')} disabled={selected?reading:loading} onClick={()=>selected?refreshDocument.current():setIndexRevision(value=>value+1)}><RefreshCw size={18} className={(selected?reading:loading)?'project-docs-refreshing':''}/></button>}
    </div>
    {selected?<article className="project-document" ref={documentHeading} tabIndex={-1} aria-label={selected.name}>
      <p className="project-document-name">{selected.name}</p>

      {documentError&&failure(documentError,'document',Boolean(document))}
      {reading&&!document&&<p role="status">{label('reading')}</p>}
      {document&&(document.content.trim()?<div className="markdown project-docs-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({href,children})=>safeWebUrl(href)?<a href={safeWebUrl(href)!} target="_blank" rel="noopener noreferrer">{children}</a>:<span>{children}</span>,img:({src,alt})=>safeWebUrl(typeof src==='string'?src:undefined)?<a className="project-docs-image-link" href={safeWebUrl(src as string)!} target="_blank" rel="noopener noreferrer">{label('attachment')}{alt?` · ${alt}`:''}</a>:<span>📎 {alt||label('attachment')}</span>}}>{document.content}</ReactMarkdown></div>:<p className="project-docs-empty">{label('emptyDocument')}</p>)}
    </article>:kind==='files'?<div className="project-docs-files" id="project-documents-list" role="region" aria-label={label('files')}><Files connection={connection} root={root} onProject={onProject}/></div>:<div id="project-documents-list" role="region" aria-label={label(kind)}>

      <h2 className="project-section-title">{label(kind)}</h2>
      {listError&&failure(listError,'list',Boolean(index))}
      {loading&&!index&&<p role="status">{label('loading')}</p>}
      {index?.truncated&&<p className="project-docs-limit" role="status">{label('truncated')}</p>}
      <div className="project-docs-list">{documents.map(item=><button key={item.path} ref={element=>{if(item.path===returnPath.current)returnFocus.current=element;}} className="project-docs-item" onClick={event=>{listScroll.current=scroller.current?.scrollTop||0;returnPath.current=item.path;returnFocus.current=event.currentTarget;setSelected(item);}}>{item.kind==='rules'?<BookOpen size={20} aria-hidden="true"/>:<FileText size={20} aria-hidden="true"/>}<span><strong>{item.name}</strong>{item.path!==item.name&&<span>{item.path}</span>}<small>{item.kind==='rules'?`${appliesTo(item)} · `:''}{item.source==='Project root'?label('rootLabel'):item.source}</small></span></button>)}</div>
      {!loading&&!listError&&!documents.length&&<div className="project-docs-empty"><h3>{label(kind==='rules'?'emptyRules':'emptyChangelog')}</h3><p>{label(kind==='rules'?'rulePaths':'changelogPaths')}</p></div>}
    </div>}
  </section>;
}
