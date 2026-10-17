import {useCallback,useEffect,useLayoutEffect,useMemo,useState,useRef} from 'react';
import {ArrowLeft,Eye,EyeOff,SlidersHorizontal,RefreshCw,GitBranch,X,ChevronDown,ChevronRight,ChevronsDownUp,ChevronsUpDown,FileDiff,ListTree,MessageSquarePlus,Copy,GitCompareArrows} from 'lucide-react';
import {useModal} from './navigation';
import {request,type Connection} from './api';
import {t,getLanguage,useLanguage} from './i18n';
import {plural} from './plural';
import type {ReviewFile} from '../server/review';
import './review.css';
export {diffRows} from './diff-rows';
import {ReviewFileDiff,FileStats,fileStatus,fileVersion} from './ReviewFileDiff';
import {ReviewContext,createScrollBus,useCodeMetrics} from './review-context';
import type {LineSelection,LineSide} from './DiffTable';
import {readViewed,writeViewed} from './review-viewed';
const extension=(path:string)=>{const name=path.split(/[\\/]/).at(-1)||path;const dot=name.lastIndexOf('.');return dot>0?name.slice(dot).toLowerCase():'(none)';};
const stored=(key:string)=>{try{return localStorage.getItem(key);}catch{return null;}};
const store=(key:string,value:string|null)=>{try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{/* Preferences are optional. */}};
const AUTO_SPLIT=900,COMPACT=600,TREE=1000;
const POLL=[5000,15000,30000];
/** Turn edit paths can be absolute or relative to another folder; a Review path matches when one ends with the other. */
const samePath=(file:string,edited:string)=>{const a=file.replaceAll('\\','/').toLowerCase(),b=edited.replaceAll('\\','/').replace(/^\.\//,'').toLowerCase();return a===b||b.endsWith('/'+a)||a.endsWith('/'+b);};

type Data={files:ReviewFile[];current:string;base:string;branches:string[];patch:string;binary:boolean;repositoryRoot?:string;projectPath?:string;scope?:string;fingerprint?:string};
type Selection={path:string}&LineSelection&{text:string[]};
export function Review({connection,cwd,onClose,initialMode='working',taskRunId,onQuote,onlyPaths}:{connection:Connection;cwd:string;onClose:()=>void;initialMode?:'working'|'branch';taskRunId?:string;onQuote?:(text:string)=>void;onlyPaths?:string[]}){
  useLanguage();
  const panel=useRef<HTMLElement|null>(null),diff=useRef<HTMLElement|null>(null),probe=useRef<HTMLSpanElement|null>(null),eye=useRef<HTMLButtonElement|null>(null),restore=useRef<HTMLButtonElement|null>(null),optionsButton=useRef<HTMLButtonElement|null>(null),filesButton=useRef<HTMLButtonElement|null>(null);
  const [reading,setReading]=useState(false),[options,setOptions]=useState(false),[navOpen,setNavOpen]=useState(false);
  const optionsPanel=useRef<HTMLDivElement|null>(null),navigatorPanel=useRef<HTMLDivElement|null>(null);
  // 4–8 px were unreadable on a phone; an old saved value falls back to the chat size.
  const [fontSize,setFontSize]=useState<number|null>(()=>{const value=Number(stored('pocket-code-diff-font-size'));return value>=10&&value<=24?value:null;});
  const [width,setWidth]=useState(0),[panelWidth,setPanelWidth]=useState(0);
  const tree=panelWidth>=TREE&&!reading;
  const [treeOpen,setTreeOpen]=useState(()=>stored('pocket-code-review-tree')!=='closed');
  const sheet=navOpen&&!(tree&&treeOpen);
  useModal(optionsPanel,options&&!reading,()=>setOptions(false));
  useModal(navigatorPanel,sheet,()=>{setNavOpen(false);filesButton.current?.focus({preventScroll:true});});
  const scrollPosition=useRef<{top:number;left:number;focus:boolean}|null>(null);
  function toggleReading(value:boolean){scrollPosition.current={top:diff.current?.scrollTop||0,left:diff.current?.scrollLeft||0,focus:true};setReading(value);}
  useLayoutEffect(()=>{const position=scrollPosition.current;if(!position)return;if(diff.current){diff.current.scrollTop=position.top;diff.current.scrollLeft=position.left;}if(position.focus)(reading?restore:eye).current?.focus({preventScroll:true});scrollPosition.current=null;},[reading]);
  const [selection,setSelection]=useState<Selection|null>(null),[notice,setNotice]=useState('');
  useModal(panel,true,()=>{if(selection)setSelection(null);else if(reading)toggleReading(false);else if(options){setOptions(false);optionsButton.current?.focus({preventScroll:true});}else onClose();});
  const [mode,setMode]=useState<string>(initialMode),[base,setBase]=useState(''),[data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[updated,setUpdated]=useState(0);
  const [fitWidth,setFitWidth]=useState(()=>stored('pocket-code-diff-fit-width')==='true');
  const [wrap,setWrap]=useState(()=>{const saved=stored('pocket-code-diff-wrap');return saved?saved==='true':window.innerWidth<COMPACT;});
  const [whitespace,setWhitespace]=useState(()=>stored('pocket-code-diff-whitespace')==='true');
  const [layout,setLayout]=useState<'auto'|'split'|'unified'>(()=>{const saved=stored('pocket-code-diff-layout');return saved==='split'||saved==='unified'?saved:'auto';});
  const [hiddenExtensions,setHiddenExtensions]=useState<string[]>(()=>{try{const value=JSON.parse(stored('pocket-code-review-hidden-types')||'[]');return Array.isArray(value)?value.filter(item=>typeof item==='string'):[];}catch{return [];}});
  const [turnOnly,setTurnOnly]=useState(!!onlyPaths?.length);
  const [opened,setOpened]=useState<Record<string,boolean>>({});
  const metrics=useCodeMetrics(probe,fontSize);
  const bus=useMemo(()=>createScrollBus(diff),[]);
  useEffect(()=>bus.attach(),[bus]);
  useEffect(()=>{const element=diff.current,outer=panel.current;if(!element||!outer)return;const measure=()=>{setWidth(element.clientWidth);setPanelWidth(outer.clientWidth);};const observer=new ResizeObserver(measure);observer.observe(element);observer.observe(outer);measure();return()=>observer.disconnect();},[]);
  // Split needs about 40 columns per side; below that it is unavailable, and Auto chooses it only on a wide panel.
  const splitMinimum=Math.round(2*(40*metrics.unit+70)),splitPossible=width>=splitMinimum;
  const effectiveLayout=layout==='auto'?(panelWidth>=AUTO_SPLIT&&splitPossible?'split':'unified'):layout==='split'&&!splitPossible?'unified':layout;
  const chooseLayout=(value:'auto'|'split'|'unified')=>{setLayout(value);store('pocket-code-diff-layout',value==='auto'?null:value);};
  // Poll by fingerprint: an unchanged comparison keeps the same data and patches, and idle polling slows down to 30 s.
  const idle=useRef(0),poke=useRef<()=>void>(()=>{}),latest=useRef<Data|null>(null);
  useEffect(()=>{latest.current=data;},[data]);
  useEffect(()=>{
    let active=true,inFlight=false,timer:ReturnType<typeof setTimeout>|undefined;
    const schedule=()=>{clearTimeout(timer);if(active&&document.visibilityState!=='hidden')timer=setTimeout(()=>void load(true),POLL[Math.min(idle.current,POLL.length-1)]);};
    const load=async(background=false)=>{
      if(inFlight||!active)return;inFlight=true;clearTimeout(timer);
      if(!background){setBusy(true);setError('');}
      const query=new URLSearchParams({cwd,mode,...(base?{base}:{}),...(whitespace?{whitespace:'1'}:{})});
      try{
        const value=await request<Data>(connection,taskRunId?'/task-runs/'+taskRunId+'/review'+(whitespace?'?whitespace=1':''):'/review?'+query);
        if(!active)return;
        const previous=latest.current;
        const same=!!previous&&(value.fingerprint&&previous.fingerprint?value.fingerprint===previous.fingerprint:JSON.stringify(previous.files)===JSON.stringify(value.files))&&previous.current===value.current&&previous.base===value.base;
        idle.current=same?idle.current+1:0;
        if(!same){latest.current=value;setData(value);}
        setError('');setUpdated(Date.now());
      }catch(error){if(active)setError((error as Error).message);}
      finally{inFlight=false;if(active){setBusy(false);schedule();}}
    };
    poke.current=()=>{if(idle.current){idle.current=0;schedule();}};
    idle.current=0;void load();
    const resume=()=>{if(document.visibilityState==='visible'){idle.current=0;void load(true);}else clearTimeout(timer);};
    document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);
    return()=>{active=false;clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);};
  },[connection,cwd,mode,base,refresh,taskRunId,whitespace]);
  useEffect(()=>{if(diff.current){diff.current.scrollTop=0;diff.current.scrollLeft=0;}setSelection(null);},[mode,base]);
  const repository=data?.repositoryRoot||cwd,repoName=repository.split(/[\\/]/).filter(Boolean).at(-1)||repository;
  const subfolder=data?.scope&&data.scope!=='.'?data.scope:'';
  const files=data?.files||[];
  const extensions=[...new Set(files.map(item=>extension(item.path)))].sort();
  const activeHidden=hiddenExtensions.filter(ext=>extensions.includes(ext));
  const turnFiles=turnOnly&&onlyPaths?.length?files.filter(item=>onlyPaths.some(path=>samePath(item.path,path))):null;
  const visibleFiles=(turnFiles||files).filter(item=>!hiddenExtensions.includes(extension(item.path)));
  const setHidden=(next:string[])=>{setHiddenExtensions(next);store('pocket-code-review-hidden-types',next.length?JSON.stringify(next):null);};
  // Viewed marks belong to this PC, repository and comparison; a new fingerprint means the agent changed the file again.
  const viewedKey=[connection.url,repository,taskRunId||mode,taskRunId?'':base||data?.base||''].join('|');
  const [viewed,setViewed]=useState<Record<string,string>>({});
  useEffect(()=>{setViewed(readViewed(viewedKey));},[viewedKey]);
  const isViewed=(file:ReviewFile)=>viewed[file.path]===fileVersion(file);
  const markViewed=useCallback((file:ReviewFile,value:boolean)=>{
    setViewed(old=>{const next={...old};if(value)next[file.path]=fileVersion(file);else delete next[file.path];writeViewed(viewedKey,next);return next;});
    // Viewed files collapse by default; when the agent edits one again it opens with a "changed" chip.
    setOpened(old=>{const next={...old};delete next[file.path];return next;});
  },[viewedKey]);
  const isOpen=(file:ReviewFile)=>opened[file.path]??!(file.generated||isViewed(file));
  const toggle=useCallback((path:string,open:boolean)=>setOpened(old=>({...old,[path]:open})),[]);
  const setAll=(open:boolean)=>setOpened(Object.fromEntries(visibleFiles.map(file=>[file.path,open])));
  const viewedCount=visibleFiles.filter(isViewed).length;
  const scrollToFile=(path:string)=>{
    setOpened(old=>({...old,[path]:true}));setNavOpen(false);
    requestAnimationFrame(()=>{const element=diff.current?.querySelector<HTMLElement>(`.review-file[data-path="${CSS.escape(path)}"]`);if(element&&diff.current){diff.current.scrollTop+=element.getBoundingClientRect().top-diff.current.getBoundingClientRect().top;element.querySelector<HTMLElement>('.review-file-toggle')?.focus({preventScroll:true});}});
  };
  /** The file whose heading is at or above the top of the diff. */
  const currentFile=()=>{
    const scroller=diff.current;if(!scroller)return -1;const top=scroller.getBoundingClientRect().top+4;let index=-1;
    scroller.querySelectorAll<HTMLElement>('.review-file').forEach((element,position)=>{if(element.getBoundingClientRect().top<=top)index=position;});
    return index;
  };
  const [currentName,setCurrentName]=useState('');
  const shown=useRef(visibleFiles);shown.current=visibleFiles;
  useEffect(()=>bus.subscribe(()=>{const index=currentFile();setCurrentName(shown.current[Math.max(0,index)]?.path||'');}),[bus]);
  const next=(step:1|-1,markCurrent=false)=>{
    const index=currentFile();
    if(markCurrent&&index>=0&&visibleFiles[index]&&!isViewed(visibleFiles[index]))markViewed(visibleFiles[index],true);
    const order=step>0?visibleFiles.slice(index+1):visibleFiles.slice(0,Math.max(0,index)).reverse();
    const target=markCurrent?order.find(file=>!isViewed(file))||visibleFiles.find((file,position)=>position!==index&&!isViewed(file)):order[0];
    if(target)scrollToFile(target.path);
  };
  const remaining=visibleFiles.filter(file=>!isViewed(file)).length;
  const selectLine=useCallback((file:ReviewFile,side:LineSide,line:number,extend:boolean,_text:string,lines:(side:LineSide,start:number,end:number)=>string[])=>{
    setSelection(old=>{
      const range=extend&&old&&old.path===file.path&&old.side===side?{start:Math.min(old.start,old.end,line),end:Math.max(old.start,old.end,line)}:{start:line,end:line};
      if(!extend&&old&&old.path===file.path&&old.side===side&&old.start===line&&old.end===line)return null;
      return {path:file.path,side,...range,text:lines(side,range.start,range.end)};
    });
  },[]);
  const quote=(value:Selection)=>`${value.path}:L${value.start}${value.end>value.start?`-L${value.end}`:''}${value.side==='old'?' '+t('(удалённые строки)'):''}\n\`\`\`\n${value.text.join('\n')}\n\`\`\``;
  const flash=(text:string)=>{setNotice(text);window.setTimeout(()=>setNotice(old=>old===text?'':old),3000);};
  useEffect(()=>{
    // Windows: n / p move between files, v marks the current file viewed, Ctrl+B switches the layout.
    const key=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||options||sheet||(event.target as HTMLElement).closest?.('input,textarea,select,[contenteditable="true"]'))return;
      // A Review left open in a hidden Windows chat (Board or Settings page) or under another dialog must not take these keys.
      const own=panel.current;if(!own?.getClientRects().length||[...document.querySelectorAll('[aria-modal="true"],dialog[open]')].some(element=>element!==own&&!own.contains(element)&&element.getClientRects().length))return;
      poke.current();
      if((event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey&&event.code==='KeyB'){event.preventDefault();chooseLayout(effectiveLayout==='split'?'unified':splitPossible?'split':'unified');return;}
      if(event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.key==='n'){event.preventDefault();next(1);}else if(event.key==='p'){event.preventDefault();next(-1);}
      else if(event.key==='v'){const file=visibleFiles[Math.max(0,currentFile())];if(file){event.preventDefault();markViewed(file,!isViewed(file));}}
    };
    document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
  });
  const modeLabel=taskRunId?t('Изменения задачи'):t(mode==='branch'?'Изменения ветки':mode==='staged'?'Подготовленные изменения':'Все изменения');
  const total=turnFiles?turnFiles.length:files.length;
  const count=!data&&error?'—':visibleFiles.length===total?plural(total,['{0} файл','{0} файла','{0} файлов']):t('{0} из {1}',visibleFiles.length,plural(total,['{0} файла','{0} файлов','{0} файлов']));
  const fileRow=(file:ReviewFile)=>{const status=fileStatus(file),slash=file.path.lastIndexOf('/');return <li key={file.path} className={currentName===file.path?'current':''}>
    <button type="button" onClick={()=>scrollToFile(file.path)} aria-current={currentName===file.path?'location':undefined}>{status&&<span className="review-file-status" data-status={status.key}>{status.label}</span>}<span className="review-nav-path"><span className="review-file-folder">{file.path.slice(0,slash+1)}</span>{file.path.slice(slash+1)}</span><FileStats file={file}/></button>
    <label className="review-nav-viewed"><input type="checkbox" aria-label={t('Просмотрено: {0}',file.path)} checked={isViewed(file)} onChange={event=>markViewed(file,event.target.checked)}/></label></li>;};
  const fileList=<>
    <div className="review-nav-actions"><span>{t('Просмотрено {0} из {1}',viewedCount,visibleFiles.length)}</span><button type="button" className="icon-button" aria-label={t('Свернуть всё')} title={t('Свернуть всё')} onClick={()=>setAll(false)}><ChevronsDownUp size={18}/></button><button type="button" className="icon-button" aria-label={t('Развернуть всё')} title={t('Развернуть всё')} onClick={()=>setAll(true)}><ChevronsUpDown size={18}/></button></div>
    <ul className="review-nav-list">{visibleFiles.map(fileRow)}</ul>
  </>;
  const emptyChanges=data&&!files.length&&!busy&&!error;
  const comparisonBranch=data?.base&&data.base!=='HEAD'?data.base:'';
  return <ReviewContext.Provider value={{metrics,bus}}><aside ref={panel} className={'review-panel'+(reading?' review-reading':'')} role="dialog" aria-label="Review" aria-modal="true" onPointerDown={()=>poke.current()}>
    <span ref={probe} className="diff-probe" aria-hidden="true" style={{fontSize:fontSize?`${fontSize}px`:undefined}}>{'0'.repeat(100)}</span>
    <header className="review-header" hidden={reading}>
      <button className="icon-button" aria-label={t('Вернуться в чат')} title={t('Вернуться в чат')} onClick={onClose}><ArrowLeft size={20}/></button>
      <div className="review-heading"><h2>Review</h2><span className="review-context" title={repository}><span className="review-repo">{repoName}{subfolder&&<span className="review-subfolder"> / {subfolder}</span>}</span>{data?.current&&<span className="review-branch"><GitBranch size={12}/>{data.current}</span>}<span className="review-mode">{modeLabel}</span></span></div>
      <button ref={eye} className="icon-button" aria-label={t('Режим чтения')} title={t('Режим чтения')} aria-pressed={reading} onClick={()=>toggleReading(true)}><Eye size={20}/></button>
      <button ref={optionsButton} className="icon-button" aria-label={t('Параметры ревью')} title={t('Параметры ревью')} aria-expanded={options} aria-controls="review-options" onClick={()=>setOptions(value=>!value)}><SlidersHorizontal size={20}/></button>
    </header>
    <div className="review-options-backdrop" hidden={!options||reading} onClick={()=>setOptions(false)}><div ref={optionsPanel} id="review-options" className="review-options" role="dialog" aria-modal="true" aria-label={t('Параметры ревью')} onClick={event=>event.stopPropagation()}>
      <div className="review-options-heading"><strong>{t('Параметры ревью')}</strong><button className="icon-button" aria-label={t('Закрыть параметры')} onClick={()=>setOptions(false)}><X size={20}/></button></div>
      <div className="review-controls"><label hidden={!!taskRunId}>{t('Сравнение')}<select aria-label={t('Сравнение')} value={mode} onChange={e=>{setMode(e.target.value);setData(null);}}><option value="working">{t('Все изменения')}</option><option value="staged">{t('Подготовленные изменения')}</option><option value="branch">{t('Изменения ветки')}</option></select></label>
      <label className="review-font-size">{t('Размер кода')}<select aria-label={t('Размер кода')} value={fontSize??''} onChange={event=>{const value=event.target.value?Number(event.target.value):null;setFontSize(value);store('pocket-code-diff-font-size',value===null?null:String(value));}}><option value="">{t('Как в чате, не меньше 14 px')}</option>{[10,12,14,16,18,20,22,24].map(size=><option key={size} value={size}>{size} px</option>)}</select></label>
      {!taskRunId&&mode==='branch'&&data&&<label className="review-base">{t('Базовая ветка')}<select aria-label={t('Базовая ветка')} value={base||data.base} onChange={e=>{setBase(e.target.value);}}>{[...new Set(['HEAD',...data.branches])].map(branch=><option key={branch}>{branch}</option>)}</select></label>}</div>
      <label className="review-toggle"><span>{t('Переносить строки')}<small>{t('В двух колонках длинные строки переносятся всегда.')}</small></span><input type="checkbox" aria-label={t('Переносить строки')} checked={wrap} onChange={event=>{setWrap(event.target.checked);store('pocket-code-diff-wrap',String(event.target.checked));}}/></label>
      <label className="review-toggle review-fit-width"><span>{t('Fit diff to width')}<small>{t('Без переноса: уменьшает код, но не мельче 60%.')}</small></span><input type="checkbox" aria-label={t('Fit diff to width')} checked={fitWidth} disabled={wrap} onChange={event=>{setFitWidth(event.target.checked);store('pocket-code-diff-fit-width',String(event.target.checked));}}/></label>
      <label className="review-toggle"><span>{t('Игнорировать пробелы')}</span><input type="checkbox" checked={whitespace} onChange={event=>{setWhitespace(event.target.checked);store('pocket-code-diff-whitespace',event.target.checked?'true':null);}}/></label>
      <fieldset className="review-extension-filters"><legend>{t('Показывать типы файлов')}</legend>{extensions.map(ext=><label key={ext} className="review-chip"><input type="checkbox" checked={!hiddenExtensions.includes(ext)} onChange={event=>setHidden(event.target.checked?hiddenExtensions.filter(value=>value!==ext):[...hiddenExtensions,ext])}/>{ext==='(none)'?t('Без расширения'):ext}</label>)}</fieldset>
      <p className="review-scope" title={data?.projectPath||cwd}>{repoName}{subfolder&&<> / {subfolder}</>}</p><p className="muted review-note">{taskRunId?t('Изменения рабочей копии задачи относительно исходного коммита.'):t('Изменения Git в папке проекта, включая правки вне этого чата.')}</p>
    </div></div>
    <div className="review-toolbar" hidden={reading}>
      <button ref={filesButton} type="button" className="review-files-button" aria-expanded={tree?treeOpen:navOpen} onClick={()=>{if(tree){const value=!treeOpen;setTreeOpen(value);store('pocket-code-review-tree',value?null:'closed');}else setNavOpen(true);}}><ListTree size={17}/><span><strong>{count}</strong>{visibleFiles.length>1&&<small>{t('Просмотрено {0}/{1}',viewedCount,visibleFiles.length)}</small>}</span>{!tree&&<ChevronDown size={15}/>}</button>
      <div className="review-layout-switch" role="group" aria-label={t('Вид сравнения')}>
        {(['auto','unified','split'] as const).map(value=><button key={value} aria-pressed={layout===value} disabled={value==='split'&&!splitPossible} title={value==='split'&&!splitPossible?t('Для двух колонок нужен экран шире'):value==='auto'?t('Две колонки на широкой панели, одна на узкой'):undefined} aria-label={value==='auto'?t('Авто'):value==='unified'?t('В одну колонку'):t('В две колонки')} onClick={()=>chooseLayout(value)}>{value==='auto'?t('Авто'):value==='unified'?'1':'2'}</button>)}
      </div>
      <button className="icon-button" disabled={busy} aria-label={t('Обновить')} title={updated?t('Обновлено в {0}',new Date(updated).toLocaleTimeString(getLanguage()==='ru'?'ru-RU':'en-US')):t('Обновить')} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={18}/></button>
      {busy&&data&&<span className="review-progress" aria-hidden="true"/>}
    </div>
    {(activeHidden.length>0||turnFiles)&&!reading&&<div className="review-filter-note">{turnFiles&&<span>{t('Только файлы этого хода')}<button type="button" className="text-button" onClick={()=>setTurnOnly(false)}>{t('Показать все')}</button></span>}{activeHidden.length>0&&<span>{t('Скрыто типов: {0}',activeHidden.length)}<button type="button" className="text-button" onClick={()=>setHidden([])}>{t('Показать все типы')}</button></span>}</div>}
    {reading&&<button type="button" className="review-reading-band" onClick={()=>{toggleReading(false);setNavOpen(true);}}><FileDiff size={14}/><span>{currentName||repoName}</span></button>}
    {reading&&<button ref={restore} className="icon-button review-restore" aria-label={t('Показать управление ревью')} title={t('Показать управление ревью')} onClick={()=>toggleReading(false)}><EyeOff size={20}/></button>}
    <p className="visually-hidden" role="status">{busy&&!data?t('Загружаем изменения…'):data&&!error?count:''}</p>
    {error&&<p className="error review-error" role="alert"><span>{t(error)}</span><button type="button" className="text-button" onClick={()=>setRefresh(n=>n+1)}>{t('Повторить')}</button></p>}
    {busy&&!data&&!error&&<div className="review-loading" aria-hidden="true"><span/><span/><span/></div>}
    <div className={'review-body'+(tree&&treeOpen?' with-tree':'')}>
      {tree&&treeOpen&&<nav className="review-tree" aria-label={t('Изменённые файлы')}>{fileList}</nav>}
      <section ref={diff} className="diff-content" aria-label={t('Изменённые файлы')} tabIndex={0}>
        {emptyChanges&&<div className="review-empty"><GitCompareArrows size={30}/><h3>{mode==='branch'&&comparisonBranch?t('Нет изменений относительно {0}',comparisonBranch):t('Нет незакоммиченных изменений в {0}',repoName)}</h3>{data?.current&&<p><GitBranch size={13}/>{data.current}</p>}<div>{!taskRunId&&mode!=='branch'&&<button type="button" className="secondary" onClick={()=>{setMode('branch');setData(null);}}>{t('Сравнить с основной веткой')}</button>}<button type="button" className="secondary" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15}/>{t('Обновить')}</button></div></div>}
        {!!files.length&&!visibleFiles.length&&<div className="review-empty"><p>{turnFiles&&!turnFiles.length?t('Файлы этого хода больше не отличаются в этом сравнении.'):t('Все файлы скрыты фильтром.')}</p><button type="button" className="secondary" onClick={()=>{setHidden([]);setTurnOnly(false);}}>{turnFiles&&!turnFiles.length?t('Показать все'):t('Показать все типы')}</button></div>}
        <div className="review-file-list">{visibleFiles.map(item=><ReviewFileDiff key={[cwd,mode,base,item.path].join('|')} file={item} taskRunId={taskRunId} connection={connection} cwd={cwd} mode={mode} base={base} layout={effectiveLayout} fontSize={fontSize} fitWidth={fitWidth} wrap={wrap} compact={width<COMPACT} width={width} whitespace={whitespace} viewport={diff} open={isOpen(item)} onToggle={toggle} viewed={isViewed(item)} changedSinceViewed={!!viewed[item.path]&&!isViewed(item)} onViewed={markViewed} selection={selection?.path===item.path?selection:null} onSelectLine={selectLine}/>)}</div>
      </section>
    </div>
    {selection&&<div className="review-selection" role="region" aria-label={t('Выбранные строки')}><span>{selection.path.split('/').at(-1)}:L{selection.start}{selection.end>selection.start&&`-L${selection.end}`}</span>
      {onQuote&&<button type="button" className="primary" onClick={()=>{onQuote(quote(selection));setSelection(null);flash(t('Добавлено в сообщение'));}}><MessageSquarePlus size={16}/>{t('Спросить агента')}</button>}
      <button type="button" className="secondary" onClick={()=>{void copyText(quote(selection)).then(ok=>flash(ok?t('Скопировано'):t('Не удалось скопировать')));setSelection(null);}}><Copy size={16}/>{t('Копировать')}</button>
      <button type="button" className="icon-button" aria-label={t('Отмена')} onClick={()=>setSelection(null)}><X size={18}/></button></div>}
    {notice&&<p className="review-notice" role="status">{notice}</p>}
    {!selection&&visibleFiles.length>1&&remaining>0&&<button type="button" className="review-next" onClick={()=>next(1,true)} title={t('Отметить файл просмотренным и перейти к следующему')}>{t('Далее')}<ChevronRight size={18}/></button>}
    {sheet&&<div className="review-options-backdrop" onClick={()=>setNavOpen(false)}><div ref={navigatorPanel} className="review-options review-navigator" role="dialog" aria-modal="true" aria-label={t('Изменённые файлы')} onClick={event=>event.stopPropagation()}>
      <div className="review-options-heading"><strong>{count}</strong><button className="icon-button" aria-label={t('Закрыть')} onClick={()=>setNavOpen(false)}><X size={20}/></button></div>
      {fileList}
    </div></div>}
  </aside></ReviewContext.Provider>;
}
async function copyText(text:string){try{await navigator.clipboard.writeText(text);return true;}catch{return false;}}
