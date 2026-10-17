import {useEffect,useMemo,useRef,useState,type ReactNode,type CSSProperties} from 'react';
import {ArrowLeft,BookOpen,FileText,RefreshCw,ListTree,ArrowUp,ExternalLink,WrapText,Image as ImageIcon,X,ChevronsDownUp,ChevronsUpDown,ShieldCheck} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {useBackAction,useModal} from './navigation';
import {safeWebUrl,CopyAction} from './RichBlocks';
import {ImageViewer} from './ImageViewer';
import {FilePreview} from './Files';
import './project-docs.css';
import {ProjectRuleSwitch} from './ProjectRuleSwitch';

type Provider='claude'|'codex'|'copilot';
type RuleReader={provider:Provider;status:'loaded'|'shadowed'|'on-demand'|'not-read';reason?:'claude-md'|'override'|'linked'|'paths'|'apply-to'};
export type ProjectDocument={path:string;name:string;kind:'rules'|'changelog';source:string;appliesTo:'all'|Provider;bytes:number;builtIn?:boolean;readers?:RuleReader[];scope?:string;lines?:number};
type DocumentIndex={project:string;documents:ProjectDocument[];truncated:boolean};
type DocumentContent=ProjectDocument&{content?:string;version?:string;unchanged?:boolean};
type Heading={id:string;depth:number;text:string};
type Props={refreshRevision?:number;category:'rules'|'changelog';connection:Connection;root:string;onRefreshProjects?():void;onChat?(root:string,prompt:string):void;onReading?(name:string):void};
type ReaderPrefs={wide:boolean;size:number};
const readerKey='pocket-code-reader-v1',readerSizes=[0.9,1,1.1,1.25];
function loadReaderPrefs():ReaderPrefs{try{const value=JSON.parse(localStorage.getItem(readerKey)||'{}');return {wide:value.wide===true,size:readerSizes.includes(value.size)?value.size:1};}catch{return {wide:false,size:1};}}
const providerName:Record<Provider,string>={claude:'Claude',codex:'Codex',copilot:'Copilot'};
const codexBudget=32*1024,claudeLines=200;
// The host always lists the built-in rule; older hosts omit it, so the card still has a document to open.
const builtInFallback:ProjectDocument={path:'pocket-code:board-maintenance',name:'Board maintenance',kind:'rules',source:'Pocket Code',appliesTo:'all',bytes:0,builtIn:true};

export function ProjectDocs(props:Props){
  useLanguage();
  if(!props.root)return <section className="project-docs"><p className="project-docs-empty">{t('Выберите проект, чтобы посмотреть его правила и изменения.')}</p></section>;
  // Remounting on project/host changes prevents even one frame of another
  // project's document and isolates all requests and navigation state.
  return <ProjectDocuments key={`${props.connection.url}\0${props.connection.token}\0${props.root}\0${props.category}`} {...props}/>;
}

/** GitHub-style heading slugs, unique within one document. */
function slugger(){const seen=new Map<string,number>();return (text:string)=>{const base=text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s/g,'-')||'section';const count=seen.get(base)||0;seen.set(base,count+1);return count?`${base}-${count}`:base;};}
type HastNode={type:string;tagName?:string;value?:string;properties?:Record<string,unknown>;children?:HastNode[]};
const hastText=(node:HastNode):string=>node.type==='text'?node.value||'':(node.children||[]).map(hastText).join('');
/** Gives every heading an id (for #anchors and the outline) and records H2/H3 for the outline. */
// The transformer can run more than once per tree (StrictMode, re-renders), so each run numbers slugs from scratch and the outline skips repeats.
function rehypeHeadings(options:{collect:Heading[]}){
  return (tree:HastNode)=>{const slug=slugger();const walk=(node:HastNode)=>{if(node.type==='element'&&/^h[1-6]$/.test(node.tagName||'')){const text=hastText(node).trim(),id=slug(text);node.properties={...node.properties,id};const depth=Number(node.tagName![1]);if((depth===2||depth===3)&&!options.collect.some(item=>item.id===id))options.collect.push({id,depth,text});return;}node.children?.forEach(walk);};walk(tree);};
}
/** Resolves a Markdown link relative to the document inside the project; null when it would leave the project. */
function resolveRelative(documentPath:string,href:string){
  const [target,anchor='']=href.split('#');const clean=decodeURIComponent(target.split('?')[0]).replace(/\\/g,'/');
  const parts=clean.startsWith('/')?[]:documentPath.split('/').slice(0,-1);
  for(const part of clean.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)return null;parts.pop();}else parts.push(part);}
  return {path:parts.join('/'),anchor:decodeURIComponent(anchor)};
}
const projectFile=(root:string,relative:string)=>root.replace(/[\\/]+$/,'')+(root.includes('\\')?'\\'+relative.replace(/\//g,'\\'):'/'+relative);
/** Splits a changelog at H2 lines outside fenced code: a preamble plus one section per version. */
function changelogSections(content:string){
  const lines=content.split(/\r?\n/),sections:{heading:string;body:string[]}[]=[],preamble:string[]=[];let fence='';
  for(const line of lines){const marker=/^\s*(```+|~~~+)/.exec(line)?.[1];if(marker){if(!fence)fence=marker[0];else if(marker[0]===fence)fence='';}
    if(!fence&&!marker&&/^##\s+/.test(line)){sections.push({heading:line.replace(/^##\s+/,''),body:[]});continue;}
    (sections.at(-1)?.body||preamble).push(line);}
  return {preamble:preamble.join('\n'),sections:sections.map(item=>({heading:item.heading,body:item.body.join('\n')}))};
}
function ReaderCode({children}:{children:ReactNode}){
  const pre=useRef<HTMLPreElement|null>(null),[wrap,setWrap]=useState(false),[overflow,setOverflow]=useState(false);
  useEffect(()=>{const element=pre.current;if(!element)return;const check=()=>setOverflow(element.scrollWidth>element.clientWidth+1);check();const observer=new ResizeObserver(check);observer.observe(element);return()=>observer.disconnect();},[wrap]);
  const child=(Array.isArray(children)?children[0]:children) as {props?:{className?:string}}|undefined,language=/language-([\w+#.-]+)/.exec(child?.props?.className||'')?.[1];
  return <div className="code-block reader-code"><div className="code-block-bar"><span>{language||t('Код')}</span><span className="reader-code-actions"><button type="button" className="copy-action" aria-pressed={wrap} onClick={()=>setWrap(value=>!value)}><WrapText size={14}/><span>{t('Перенос')}</span></button><CopyAction text={()=>pre.current?.innerText.replace(/\n$/,'')||''} label={t('Копировать')}/></span></div><div className={'reader-code-scroll'+(overflow&&!wrap?' overflowing':'')}><pre ref={pre} className={wrap?'wrap':''}>{children}</pre></div></div>;
}
function RepoImage({connection,root,path,alt}:{connection:Connection;root:string;path:string;alt:string}){
  const [src,setSrc]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[expanded,setExpanded]=useState(false);
  if(src)return <><button className="image-preview" aria-label={t('Открыть изображение')} onClick={()=>setExpanded(true)}><img src={src} alt={alt}/></button>{expanded&&<ImageViewer src={src} title={alt||path} onClose={()=>setExpanded(false)}/>}</>;
  return <span className="project-docs-image-load"><button className="secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const value=await request<{mimeType:string;data?:string}>(connection,`/project-artifact?cwd=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`);if(value.data&&/^image\//.test(value.mimeType))setSrc(`data:${value.mimeType};base64,${value.data}`);else setError(t('Этот файл нельзя показать'));}catch(e){setError(t((e as Error).message));}finally{setBusy(false);}}}><ImageIcon size={16}/>{t('Показать изображение')}{alt?` · ${alt}`:''}</button>{error&&<small role="alert">{error}</small>}</span>;
}

function ProjectDocuments({refreshRevision=0,category,connection,root,onRefreshProjects,onChat,onReading}:Props){
  const language=useLanguage();
  const [index,setIndex]=useState<DocumentIndex|null>(null),[loading,setLoading]=useState(true),[listError,setListError]=useState('');
  const [indexRevision,setIndexRevision]=useState(0),[selected,setSelected]=useState<ProjectDocument|null>(null);
  const [document,setDocument]=useState<DocumentContent|null>(null),[reading,setReading]=useState(false),[documentError,setDocumentError]=useState('');
  const [trail,setTrail]=useState<{doc:ProjectDocument;scroll:number}[]>([]),[filePreview,setFilePreview]=useState(''),[builtInOn,setBuiltInOn]=useState(true);
  const [toc,setToc]=useState<Heading[]>([]),[tocOpen,setTocOpen]=useState(false),[showTop,setShowTop]=useState(false),[openSections,setOpenSections]=useState<Set<number>|null>(null),[chainProvider,setChainProvider]=useState<Provider>('claude');
  const refreshDocument=useRef<()=>void>(()=>{}),versionRef=useRef('');
  const scroller=useRef<HTMLElement|null>(null),listScroll=useRef(0),documentHeading=useRef<HTMLElement|null>(null),tocSheet=useRef<HTMLElement|null>(null);
  const returnFocus=useRef<HTMLButtonElement|null>(null),returnPath=useRef(''),focusBack=useRef(false),pendingAnchor=useRef(''),restoreScroll=useRef<number|null>(null);
  const pendingAutoOpen=useRef(true),directDocument=useRef(false),collected=useRef<Heading[]>([]);
  const [prefs,setPrefs]=useState<ReaderPrefs>(loadReaderPrefs),[prefsOpen,setPrefsOpen]=useState(false);
  const updatePrefs=(next:ReaderPrefs)=>{setPrefs(next);try{localStorage.setItem(readerKey,JSON.stringify(next));}catch{/* Reader preferences are a per-device convenience. */}};
  const cwd=`cwd=${encodeURIComponent(root)}`;
  function openDocument(item:ProjectDocument,anchor=''){pendingAnchor.current=anchor;setTrail(old=>selected?[...old,{doc:selected,scroll:scroller.current?.scrollTop||0}]:old);setSelected(item);}
  function goBack(){
    const previous=trail.at(-1);
    if(previous){setTrail(old=>old.slice(0,-1));restoreScroll.current=previous.scroll;setSelected(previous.doc);return;}
    directDocument.current=false;setSelected(null);focusBack.current=true;
  }
  useBackAction(()=>{goBack();return true;},20,Boolean(selected&&(trail.length||!directDocument.current||category==='rules')));
  useModal(tocSheet,tocOpen,()=>setTocOpen(false));

  useEffect(()=>{
    let cancelled=false;setLoading(true);setListError('');
    request<DocumentIndex>(connection,`/project-docs?${cwd}`).then(value=>{if(!cancelled)setIndex(value);}).catch(error=>{if(!cancelled)setListError(error.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[connection,cwd,indexRevision,refreshRevision]);
  const documents=index?.documents.filter(item=>item.kind===category&&!item.builtIn)||[],builtIn=index?.documents.find(item=>item.builtIn)||builtInFallback;
  useEffect(()=>{
    // Only an authored document opens directly; the built-in rule never does.
    if(!pendingAutoOpen.current||!index||loading||listError)return;
    pendingAutoOpen.current=false;
    if(documents.length===1&&!index.truncated){directDocument.current=true;setSelected(documents[0]);}
  },[index,loading,listError]);
  useEffect(()=>{
    if(!selected){setDocument(null);setDocumentError('');setReading(false);refreshDocument.current=()=>{};versionRef.current='';return;}
    let cancelled=false,inFlight=false;setDocument(old=>old?.path===selected.path?old:null);setDocumentError('');setOpenSections(null);versionRef.current='';
    async function load(){
      if(cancelled||inFlight)return;inFlight=true;setReading(true);
      try{
        // The host answers `unchanged` for the version already shown, so polling does not resend or re-render the document.
        const known=versionRef.current?`&known=${encodeURIComponent(versionRef.current)}`:'';
        const value=await request<DocumentContent>(connection,`/project-doc?${cwd}&path=${encodeURIComponent(selected!.path)}${known}`);
        if(!cancelled){if(!value.unchanged){versionRef.current=value.version||'';setDocument({...value,path:selected!.path});}setDocumentError('');}
      }
      catch(error){if(!cancelled)setDocumentError((error as Error).message);}
      finally{inFlight=false;if(!cancelled)setReading(false);}
    }
    refreshDocument.current=()=>{void load();};void load();
    const timer=window.setInterval(()=>{if(globalThis.document.visibilityState!=='hidden')void load();},15000);
    return()=>{cancelled=true;window.clearInterval(timer);refreshDocument.current=()=>{};};
  },[connection,cwd,selected?.path,refreshRevision]);
  useEffect(()=>{
    if(selected){documentHeading.current?.focus({preventScroll:true});if(restoreScroll.current===null&&!pendingAnchor.current)scroller.current?.scrollTo({top:0});}
    else if(focusBack.current){focusBack.current=false;if(scroller.current)scroller.current.scrollTop=listScroll.current;returnFocus.current?.focus({preventScroll:true});}
  },[selected]);
  useEffect(()=>{
    if(!document||document.path!==selected?.path)return;
    const next=collected.current;if(JSON.stringify(next)!==JSON.stringify(toc))setToc(next);
    if(restoreScroll.current!==null){const top=restoreScroll.current;restoreScroll.current=null;requestAnimationFrame(()=>scroller.current?.scrollTo({top}));}
    if(pendingAnchor.current){const anchor=pendingAnchor.current;pendingAnchor.current='';requestAnimationFrame(()=>jump(anchor));}
  },[document]);
  const changelog=selected?.kind==='changelog'&&document?.content?changelogSections(document.content):null;
  const defaultOpen=useMemo(()=>{if(!changelog)return new Set<number>();const first=changelog.sections[0]?.heading||'';return new Set(/unreleased|не выпущ/i.test(first)?[0,1]:[0]);},[document?.content]);
  const open=openSections||defaultOpen;
  const versionIds=useMemo(()=>{const make=slugger();return changelog?.sections.map(item=>make(item.heading.replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[`*_]/g,'')))||[];},[document?.content]);
  function jump(anchor:string){
    const id=anchor.toLowerCase();const sectionIndex=versionIds.indexOf(id);
    if(sectionIndex>=0&&!open.has(sectionIndex)){setOpenSections(new Set([...open,sectionIndex]));requestAnimationFrame(()=>globalThis.document.getElementById(id)?.scrollIntoView({block:'start'}));return;}
    const target=scroller.current?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`)||scroller.current?.querySelector<HTMLElement>(`[id="${CSS.escape(anchor)}"]`);
    target?.scrollIntoView({block:'start'});
  }
  function followLink(href:string){
    if(href.startsWith('#')){jump(decodeURIComponent(href.slice(1)));return;}
    const target=selected&&resolveRelative(selected.builtIn?'':selected.path,href);if(!target)return;
    if(!target.path){if(target.anchor)jump(target.anchor);return;}
    const doc=index?.documents.find(item=>item.path.toLowerCase()===target.path.toLowerCase());
    if(doc){if(doc.path===selected?.path){if(target.anchor)jump(target.anchor);}else openDocument(doc,target.anchor);return;}
    setFilePreview(projectFile(root,target.path));
  }
  const markdownComponents=useMemo(()=>({
    a:({href,children}:{href?:string;children?:ReactNode})=>{const web=safeWebUrl(href);if(web)return <a href={web} target="_blank" rel="noopener noreferrer">{children}</a>;if(!href||/^[a-z][a-z\d+.-]*:/i.test(href)||selected?.builtIn&&!href.startsWith('#'))return <span>{children}</span>;return <a href={href} className="project-docs-internal-link" onClick={event=>{event.preventDefault();followLink(href);}}>{children}</a>;},
    img:({src,alt}:{src?:unknown;alt?:string})=>{const value=typeof src==='string'?src:undefined,web=safeWebUrl(value);if(web)return <a className="project-docs-image-link" href={web} target="_blank" rel="noopener noreferrer">{t('Открыть ссылку на изображение')}{alt?` · ${alt}`:''}</a>;const target=value&&selected&&!selected.builtIn&&!/^[a-z][a-z\d+.-]*:/i.test(value)?resolveRelative(selected.path,value):null;return target?.path?<RepoImage connection={connection} root={root} path={target.path} alt={alt||''}/>:<span>📎 {alt||t('Изображение')}</span>;},
    pre:({children}:{children?:ReactNode})=><ReaderCode>{children}</ReaderCode>,
    table:({children}:{children?:ReactNode})=><div className="project-docs-table"><table>{children}</table></div>,
  }),[selected?.path,index,root,connection,versionIds,open]);
  const body=useMemo(()=>{
    if(!document?.content||document.path!==selected?.path)return null;
    collected.current=[];const plugins=[[rehypeHeadings,{collect:collected.current}]] as never;
    if(changelog)return <>{changelog.preamble.trim()&&<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={plugins} components={markdownComponents as never}>{changelog.preamble}</ReactMarkdown>}
      {changelog.sections.length>1&&<><div className="changelog-tools"><button className="text-button" onClick={()=>setOpenSections(new Set(changelog.sections.map((_,index)=>index)))}><ChevronsUpDown size={16}/>{t('Развернуть все')}</button><button className="text-button" onClick={()=>setOpenSections(new Set())}><ChevronsDownUp size={16}/>{t('Свернуть все')}</button></div>
      <nav className="changelog-chips" aria-label={t('Версии')}>{changelog.sections.slice(0,24).map((item,index)=><button key={index} className="changelog-chip" onClick={()=>jump(versionIds[index])}>{item.heading.replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[`*_]/g,'').split(/\s+[-–—]\s+/)[0].slice(0,24)}</button>)}</nav></>}
      {changelog.sections.map((item,index)=><details key={index} className="changelog-version" open={open.has(index)} onToggle={event=>{const isOpen=event.currentTarget.open;if(isOpen===open.has(index))return;const next=new Set(open);if(isOpen)next.add(index);else next.delete(index);setOpenSections(next);}}>
        <summary id={versionIds[index]}><h2><ReactMarkdown remarkPlugins={[remarkGfm]} components={{p:({children})=><>{children}</>,a:({href,children})=>{const web=safeWebUrl(href);return web?<><span>{children}</span><a className="changelog-version-link" href={web} target="_blank" rel="noopener noreferrer" aria-label={t('Открыть версию в браузере')} onClick={event=>event.stopPropagation()}><ExternalLink size={14}/></a></>:<span>{children}</span>;}}}>{item.heading}</ReactMarkdown></h2></summary>
        {open.has(index)&&<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={plugins} components={markdownComponents as never}>{item.body}</ReactMarkdown>}
      </details>)}</>;
    return <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={plugins} components={markdownComponents as never}>{document.content}</ReactMarkdown>;
  },[document,selected?.path,markdownComponents,open,versionIds]);
  const outline=changelog?changelog.sections.map((item,index)=>({id:versionIds[index],depth:2,text:item.heading.replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[`*_]/g,'')})):toc;
  const docName=(item:ProjectDocument)=>item.builtIn?t('Обслуживание доски'):item.name;
  useEffect(()=>{onReading?.(selected?docName(selected):'');},[selected,language]);
  useEffect(()=>()=>onReading?.(''),[]);
  const failure=(message:string,kind:'list'|'document',saved:boolean)=><div className="project-docs-error" role="alert"><p>{t(kind==='list'?'Не удалось обновить документы.':'Не удалось обновить документ.')}{saved?` ${t('Ниже остаётся последняя загруженная версия.')}`:''}</p><details><summary>{t('Подробности')}</summary><p>{t(message)}</p></details><button className="secondary" disabled={kind==='list'?loading:reading} onClick={()=>kind==='list'?setIndexRevision(value=>value+1):refreshDocument.current()}>{t('Повторить')}</button></div>;
  const readerChips=(item:ProjectDocument)=>{
    const readers=item.readers||[];if(readers.length&&readers.every(reader=>reader.status==='on-demand'&&reader.reason==='linked'))return <span className="rule-chip on-demand">{t('По ссылке из других правил')}</span>;
    return readers.filter(reader=>reader.status!=='not-read').map(reader=><span key={reader.provider} className={'rule-chip '+reader.status}>{providerName[reader.provider]}: {reader.status==='loaded'?t('читает'):reader.status==='shadowed'?(reader.reason==='claude-md'?t('не читает (есть CLAUDE.md)'):t('заменён AGENTS.override.md')):reader.reason==='paths'||reader.reason==='apply-to'?t('для файлов {0}',item.scope||'…'):t('по ссылке')}</span>);
  };
  const refreshLabel=t(selected?'Обновить документ':'Обновить документы');
  const refreshing=selected?reading:loading;

  if(selected)return <section className={'project-docs project-docs-reading'+(prefs.wide?' wide':'')} style={{'--reader-scale':prefs.size} as CSSProperties} ref={scroller} aria-label={docName(selected)} onScroll={event=>setShowTop(event.currentTarget.scrollTop>event.currentTarget.clientHeight)}>
    <div className="project-docs-toolbar">
      {(trail.length||!directDocument.current||category==='rules')?<button className="text-button project-overview-back" onClick={goBack}><ArrowLeft size={18}/><span>{trail.length?t('Назад к {0}',docName(trail.at(-1)!.doc)):t(category==='rules'?'Все правила':'К документам')}</span></button>:<span/>}
      <span className="project-docs-actions">
        <span className="project-docs-prefs-anchor"><button className="icon-button project-docs-prefs-button" aria-label={t('Вид читалки')} aria-expanded={prefsOpen} onClick={()=>setPrefsOpen(value=>!value)}><span aria-hidden="true">Aa</span></button>{prefsOpen&&<div className="project-docs-prefs" role="group" aria-label={t('Вид читалки')}>
          <div className="segmented" role="group" aria-label={t('Ширина текста')}><button aria-pressed={!prefs.wide} onClick={()=>updatePrefs({...prefs,wide:false})}>{t('Узкая')}</button><button aria-pressed={prefs.wide} onClick={()=>updatePrefs({...prefs,wide:true})}>{t('Широкая')}</button></div>
          <div className="segmented" role="group" aria-label={t('Размер текста')}>{readerSizes.map(size=><button key={size} aria-pressed={prefs.size===size} aria-label={t('Размер текста {0}%',Math.round(size*100))} onClick={()=>updatePrefs({...prefs,size})}><span style={{fontSize:`${size}em`}}>A</span></button>)}</div>
        </div>}</span>
        {outline.length>1&&<button className="icon-button project-docs-toc-button" aria-label={t('Оглавление')} aria-expanded={tocOpen} onClick={()=>setTocOpen(true)}><ListTree size={18}/></button>}
        <button className="icon-button" aria-label={refreshLabel} disabled={refreshing} onClick={()=>refreshDocument.current()}><RefreshCw size={18} className={refreshing?'project-docs-refreshing':''}/></button>
      </span>
    </div>
    {(selected.builtIn||selected.path!==selected.name||!onReading)&&<p className="project-document-name" aria-label={t('Путь к файлу')}>{selected.builtIn?t('Встроено в Pocket Code'):selected.path}</p>}
    <div className="project-docs-reader">
      <article className="project-document" ref={documentHeading} tabIndex={-1} aria-label={docName(selected)}>
        {documentError&&failure(documentError,'document',Boolean(document))}
        {reading&&!document&&<div className="skeleton-lines" aria-hidden="true">{[90,70,95,60,85,40].map((width,index)=><span key={index} style={{width:width+'%'}}/>)}</div>}
        {reading&&!document&&<p className="visually-hidden" role="status">{t('Загружаем документ…')}</p>}
        {document&&(document.content?.trim()?<div className="markdown project-docs-markdown">{body}</div>:<p className="project-docs-empty">{t('Этот документ пока пуст.')}</p>)}
      </article>
      {outline.length>1&&<nav className="project-docs-toc-aside" aria-label={t('Оглавление')}><strong>{t('Оглавление')}</strong>{outline.map(item=><button key={item.id} className={'toc-item depth-'+item.depth} onClick={()=>jump(item.id)}>{item.text}</button>)}</nav>}
    </div>
    {showTop&&<button className="project-docs-top" aria-label={t('Наверх')} onClick={()=>scroller.current?.scrollTo({top:0,behavior:'smooth'})}><ArrowUp size={20}/></button>}
    {tocOpen&&<div className="modal-backdrop project-docs-toc-backdrop" onClick={event=>{if(event.target===event.currentTarget)setTocOpen(false);}}><section ref={tocSheet} className="project-docs-toc-sheet" role="dialog" aria-modal="true" aria-label={t('Оглавление')}><header><strong>{t('Оглавление')}</strong><button className="icon-button" aria-label={t('Закрыть')} onClick={()=>setTocOpen(false)}><X size={20}/></button></header><div>{outline.map(item=><button key={item.id} className={'toc-item depth-'+item.depth} onClick={()=>{setTocOpen(false);requestAnimationFrame(()=>jump(item.id));}}>{item.text}</button>)}</div></section></div>}
    {filePreview&&<FilePreview connection={connection} root={root} path={filePreview} onClose={()=>setFilePreview('')}/>}
  </section>;

  const authored=documents.length>0,isRules=category==='rules';
  return <section className="project-docs" ref={scroller} aria-label={t(isRules?'Правила':'История изменений')}>
    <div className="project-docs-toolbar project-docs-toolbar-list"><span/><span className="project-docs-actions"><button className="icon-button" aria-label={refreshLabel} disabled={refreshing} onClick={()=>{if(onRefreshProjects)onRefreshProjects();else setIndexRevision(value=>value+1);}}><RefreshCw size={18} className={refreshing?'project-docs-refreshing':''}/></button></span></div>
    <div id="project-documents-list" role="region" aria-label={t(isRules?'Правила':'История изменений')}>
      {listError&&failure(listError,'list',Boolean(index))}
      {loading&&!index&&<><div className="project-docs-list" aria-hidden="true">{[0,1,2].map(item=><span key={item} className="skeleton-card"/>)}</div><p className="visually-hidden" role="status">{t('Загружаем документы…')}</p></>}
      {index?.truncated&&<p className="project-docs-limit" role="status">{t('Показаны не все документы: достигнут лимит проекта.')}</p>}
      {isRules&&index&&!listError&&authored&&builtIn&&<ProjectRuleSwitch connection={connection} root={root} onChange={setBuiltInOn} onOpen={()=>{listScroll.current=scroller.current?.scrollTop||0;returnPath.current='';returnFocus.current=null;setSelected(builtIn);}}/>}
      <div className="project-docs-list">{documents.map(item=><button key={item.path} ref={element=>{if(item.path===returnPath.current)returnFocus.current=element;}} className="project-docs-item" onClick={event=>{listScroll.current=scroller.current?.scrollTop||0;returnPath.current=item.path;returnFocus.current=event.currentTarget;setSelected(item);}}>{item.kind==='rules'?<BookOpen size={20} aria-hidden="true"/>:<FileText size={20} aria-hidden="true"/>}<span><strong>{item.name}</strong>{item.path!==item.name&&<small>{item.source}</small>}{item.kind==='rules'&&<span className="rule-chips">{readerChips(item)}</span>}</span></button>)}</div>
      {isRules&&authored&&<p className="project-docs-legend">{t('«Читает» — файл загружается автоматически. «По ссылке» — агент откроет его, если на файл ссылается другое правило.')}</p>}
      {isRules&&authored&&index&&<AgentChain documents={index.documents} builtInOn={builtInOn} provider={chainProvider} onProvider={setChainProvider} onAudit={onChat?()=>onChat(root,t('Проверь правила этого проекта для AI-агентов: какие файлы читают Claude, Codex и Copilot, нет ли противоречий, дублей и устаревших указаний, не слишком ли они длинные. Ничего не меняй — только отчёт с предложениями.')):undefined}/>}
      {!loading&&!listError&&!authored&&<div className="project-docs-empty"><h3>{t(isRules?'Правила проекта пока не найдены.':'Журнал изменений пока не найден.')}</h3><p>{t(isRules?'Поддерживаются AGENTS.md, AGENTS.override.md, CLAUDE.md, CLAUDE.local.md, .claude/CLAUDE.md, RULES.md, .github/copilot-instructions.md, .github/instructions/*.instructions.md и Markdown-файлы в rules, .claude/rules, .codex/rules или .agents/rules.':'Здесь отображаются журналы CHANGELOG.md, CHANGES.md или HISTORY.md проекта, в том числе поддерживаемые варианты в docs/.')}</p>{isRules&&onChat&&<button className="secondary" onClick={()=>onChat(root,t('Создай в корне проекта файл AGENTS.md с правилами для AI-агентов: как собрать и проверить проект, структура папок, стиль кода и что нельзя делать. Сначала изучи репозиторий, затем покажи изменения на одобрение.'))}>{t('Создать AGENTS.md с помощью ИИ')}</button>}</div>}
    </div>
  </section>;
}

const chainOrder=(path:string)=>{const lower=path.toLowerCase();return ['agents.override.md','agents.md','claude.md','.claude/claude.md','claude.local.md','.github/copilot-instructions.md'].indexOf(lower)+1||(lower.startsWith('.claude/rules/')?7:lower.startsWith('.github/instructions/')?8:9);};
const standardSlots:Record<Provider,string[]>={claude:['CLAUDE.md','.claude/CLAUDE.md','CLAUDE.local.md'],codex:['AGENTS.override.md','AGENTS.md'],copilot:['.github/copilot-instructions.md','AGENTS.md']};
/** What one provider reads in this project, in order, with missing standard files and size guidance. */
function AgentChain({documents,builtInOn,provider,onProvider,onAudit}:{documents:ProjectDocument[];builtInOn:boolean;provider:Provider;onProvider(provider:Provider):void;onAudit?():void}){
  const authored=documents.filter(item=>item.kind==='rules'&&!item.builtIn);
  const reader=(item:ProjectDocument)=>item.readers?.find(value=>value.provider===provider);
  const relevant=authored.filter(item=>reader(item)&&reader(item)!.status!=='not-read').sort((a,b)=>{const rank=(item:ProjectDocument)=>({loaded:0,'on-demand':1,shadowed:2,'not-read':3})[reader(item)!.status];return rank(a)-rank(b)||chainOrder(a.path)-chainOrder(b.path)||a.path.localeCompare(b.path);});
  const missing=standardSlots[provider].filter(slot=>!authored.some(item=>item.path.toLowerCase()===slot.toLowerCase()));
  const codexBytes=authored.filter(item=>reader(item)?.status==='loaded'&&provider==='codex').reduce((sum,item)=>sum+item.bytes,0);
  const longClaude=provider==='claude'?authored.filter(item=>/(^|\/)claude(\.local)?\.md$/i.test(item.path)&&(item.lines||0)>claudeLines):[];
  const kb=(bytes:number)=>(bytes/1024).toFixed(bytes<10240?1:0);
  return <section className="agent-chain" aria-labelledby="agent-chain-title">
    <h3 id="agent-chain-title"><ShieldCheck size={18} aria-hidden="true"/>{t('Что видит агент')}</h3>
    <div className="segmented" role="group" aria-label={t('Провайдер')}>{(['claude','codex','copilot'] as const).map(value=><button key={value} aria-pressed={provider===value} onClick={()=>onProvider(value)}>{providerName[value]}</button>)}</div>
    <ol className="agent-chain-list">
      {builtInOn&&<li className="loaded"><span>{t('Обслуживание доски')}</span><small>{t('Встроено в Pocket Code')}</small></li>}
      {relevant.map(item=>{const value=reader(item)!;return <li key={item.path} className={value.status}><span>{item.path}</span><small>{value.status==='loaded'?t('читается'):value.status==='shadowed'?(value.reason==='claude-md'?t('не читается: есть CLAUDE.md'):t('не читается: есть AGENTS.override.md')):value.reason==='linked'?t('только по ссылке'):t('для файлов {0}',item.scope||'…')}</small></li>;})}
      {missing.map(slot=><li key={slot} className="missing"><span>{slot}</span><small>{t('не создан')}</small></li>)}
    </ol>
    {provider==='codex'&&<div className={'agent-chain-meter'+(codexBytes>codexBudget?' over':codexBytes>codexBudget*0.8?' warn':'')}><span>{t('Бюджет инструкций Codex: {0} КБ из {1} КБ',kb(codexBytes),kb(codexBudget))}</span><meter min={0} max={codexBudget} low={codexBudget*0.8} high={codexBudget} optimum={0} value={Math.min(codexBytes,codexBudget)}/>{codexBytes>codexBudget&&<small>{t('Codex обрежет инструкции сверх лимита.')}</small>}</div>}
    {longClaude.map(item=><p key={item.path} className="agent-chain-meter warn">{t('{0}: {1} строк. Длинные файлы правил агент соблюдает хуже; старайтесь держать до {2}.',item.path,item.lines,claudeLines)}</p>)}
    {onAudit&&<button className="secondary" onClick={onAudit}>{t('Проверить правила')}</button>}
  </section>;
}
