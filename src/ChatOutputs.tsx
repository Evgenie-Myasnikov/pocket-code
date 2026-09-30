import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ChevronRight,Code2,ExternalLink,FileText,Image,Link,RefreshCw,Wrench,X} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import {Markdown,RichBlock,safeWebUrl,imageSource} from './RichBlocks';
import {extractChatOutputs,OUTPUT_LIMIT,type ChatOutput,type OutputCategory,type OutputSource} from './chat-outputs';
import type {ChatMessage} from '../server/types';
import './chat-outputs.css';

type Props={connection:Connection;cwd:string;messages:ChatMessage[];onClose:()=>void;onLoadMore?:()=>void;hasMore?:boolean;loadingMore?:boolean};
type Artifact={name:string;mimeType:string;data?:string;text?:string};
const words={
  title:['Results','Результаты'],close:['Back to chat','Вернуться в чат'],back:['All results','Все результаты'],
  results:['Assistant results','Результаты AI'],sources:['Your sources','Ваши материалы'],all:['All','Всё'],
  images:['Images','Изображения'],documents:['Documents','Документы'],code:['Code','Код'],links:['Links','Ссылки'],tools:['Tools','Инструменты'],
  loaded:['Loaded conversation · newest first','Загруженная часть чата · сначала новые'],earlier:['Load more messages','Загрузить ещё сообщения'],loading:['Loading…','Загрузка…'],
  limit:['Showing up to 800 recent items. The full content remains in the chat.','Показано до 800 последних элементов. Полное содержимое остаётся в чате.'],
  empty:['Nothing in this category in the loaded conversation.','В загруженной части чата нет элементов этой категории.'],
  open:['Open link','Открыть ссылку'],retry:['Retry preview','Повторить загрузку'],file:['Show current file','Показать текущий файл'],
  fileNote:['Current file on the PC. It may differ from the version in the chat.','Текущий файл на ПК. Он может отличаться от версии в чате.'],
  saved:['Saved content from this conversation','Содержимое, сохранённое в этом чате'],
  missing:['This item has no supported preview.','Для этого элемента нет поддерживаемого предпросмотра.'],
  remote:['External content opens only when you choose to load it.','Внешнее содержимое загружается только по вашему нажатию.'],
  categories:['Visibility categories','Категории видимости'],scope:['Show results or sources','Показывать результаты или материалы'],
  image:['Image','Изображение'],document:['Document','Документ'],toolResult:['Tool result','Результат инструмента'],toolError:['Tool error','Ошибка инструмента'],
} as const;
const icons={images:Image,documents:FileText,code:Code2,links:Link,tools:Wrench};
const categories=['all','images','documents','code','links','tools'] as const;
export function ChatOutputs(props:Props){return <OutputPanel key={`${props.connection.url}|${props.connection.token}|${props.cwd}`} {...props}/>;}
function OutputPanel({connection,cwd,messages,onClose,onLoadMore,hasMore,loadingMore}:Props){
  const language=useLanguage(),label=(key:keyof typeof words)=>words[key][language==='ru'?1:0];
  const outputs=useMemo(()=>extractChatOutputs(messages),[messages]);
  const [source,setSource]=useState<OutputSource>('results'),[filter,setFilter]=useState<'all'|OutputCategory>('all'),[selected,setSelected]=useState<ChatOutput|null>(null);
  const panel=useRef<HTMLElement|null>(null),scroll=useRef<HTMLDivElement|null>(null),backButton=useRef<HTMLButtonElement|null>(null),savedScroll=useRef(0),first=useRef(true);
  useModal(panel,true,()=>selected?setSelected(null):onClose());
  useEffect(()=>{if(scroll.current)scroll.current.scrollTop=selected?0:savedScroll.current;if(!first.current)backButton.current?.focus({preventScroll:true});first.current=false;},[selected]);
  const scoped=outputs.filter(item=>item.source===source),visible=scoped.filter(item=>filter==='all'||item.category===filter);
  const title=(item:ChatOutput)=>item.title==='Image'?label('image'):item.title==='Document'?label('document'):item.title==='Code'?label('code'):item.title==='Tool result'?label('toolResult'):item.title==='Tool error'?label('toolError'):item.title;
  const choose=(item:ChatOutput)=>{savedScroll.current=scroll.current?.scrollTop||0;setSelected(item);};
  const changeSource=(value:OutputSource)=>{setSource(value);setFilter('all');savedScroll.current=0;if(scroll.current)scroll.current.scrollTop=0;};
  return <aside ref={panel} className="chat-outputs-panel" role="dialog" aria-modal="true" aria-label={label('title')}>
    <header className="chat-outputs-header"><h2>{label('title')}</h2><button className="icon-button" aria-label={label('close')} onClick={onClose}><X size={20}/></button></header>
    {selected?<div className="chat-outputs-back"><button ref={backButton} onClick={()=>setSelected(null)}><ArrowLeft size={18}/>{label('back')}</button></div>:<div className="chat-outputs-filters">
      <div className="chat-output-scope" role="group" aria-label={label('scope')}>{(['results','sources'] as const).map(value=><button key={value} aria-pressed={source===value} onClick={()=>changeSource(value)}>{label(value)}</button>)}</div>
      <div className="chat-output-categories" role="group" aria-label={label('categories')}>{categories.map(value=><button key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value);if(scroll.current)scroll.current.scrollTop=0;}}>{label(value)} <span>{value==='all'?scoped.length:scoped.filter(item=>item.category===value).length}</span></button>)}</div>
    </div>}
    <div ref={scroll} className="chat-outputs-scroll">
      {selected?<><h3 className="chat-output-title">{title(selected)}</h3><OutputPreview key={selected.id} output={selected} connection={connection} cwd={cwd} label={label}/></>:<>
        <p className="chat-output-note">{label('loaded')}</p>
        {outputs.length>=OUTPUT_LIMIT&&<p className="chat-output-note">{label('limit')}</p>}
        {!visible.length&&<p className="chat-output-empty">{label('empty')}</p>}
        <ul className="chat-output-list">{visible.map(item=>{const Icon=icons[item.category],thumbnail=item.block?.type==='image'?imageSource(item.block):null;return <li key={item.id}><button onClick={()=>choose(item)} className="chat-output-row">{thumbnail?.startsWith('data:')?<img className="chat-output-thumbnail" src={thumbnail} alt="" loading="lazy"/>:<Icon size={20}/>}<span><strong>{title(item)}</strong><small>{item.path||item.href||label(item.category)}</small></span><ChevronRight size={18}/></button></li>;})}</ul>
        {hasMore&&onLoadMore&&<button className="secondary chat-output-earlier" onClick={onLoadMore} disabled={loadingMore}>{loadingMore?label('loading'):label('earlier')}</button>}
      </>}
    </div>
  </aside>;
}
function OutputPreview({output,connection,cwd,label}:{output:ChatOutput;connection:Connection;cwd:string;label:(key:keyof typeof words)=>string}){
  const [artifact,setArtifact]=useState<Artifact|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[loadFile,setLoadFile]=useState(!output.text),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;if(!output.path||!loadFile)return;setLoading(true);setError('');setArtifact(null);
    void request<Artifact>(connection,`/project-artifact?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(output.path)}`).then(value=>{if(active)setArtifact(value);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:String(reason));}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[connection,cwd,output.path,loadFile,attempt]);
  if(loading)return <p role="status">{label('loading')}</p>;
  if(error)return <div className="chat-output-error" role="status"><p>{error}</p><button className="secondary" onClick={()=>setAttempt(value=>value+1)}><RefreshCw size={16}/>{label('retry')}</button></div>;
  const block=artifact?artifact.data?{type:artifact.mimeType.startsWith('image/')?'image':'document',title:artifact.name,source:{type:'base64',media_type:artifact.mimeType,data:artifact.data}}:null:output.block;
  const text=artifact?.text??output.text??(output.block?.type==='document'?output.block.source?.text:undefined);
  const isMarkdown=artifact?/\.(md|markdown)$/i.test(artifact.name)||artifact.mimeType==='text/markdown':output.language==='markdown';
  const web=safeWebUrl(output.href);
  return <div className="chat-output-preview">
    {artifact&&<p className="chat-output-note">{label('fileNote')}</p>}
    {output.path&&!artifact&&output.text!==undefined&&<><p className="chat-output-note">{label('saved')}</p><button className="secondary" onClick={()=>setLoadFile(true)}>{label('file')}</button></>}
    {text!==undefined&&(isMarkdown?<Markdown text={text}/>:<pre className="chat-output-code"><code>{text}</code></pre>)}
    {block&&text===undefined&&<RichBlock block={block}/>}
    {web&&<>
      <p className="chat-output-note">{label('remote')}</p>
      {output.category==='images'&&<RichBlock block={{type:'image',title:output.title,source:{type:'url',url:web}}}/>}
      <a className="secondary chat-output-external" href={web} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>{label('open')}</a>
      <p className="chat-output-note">{web}</p>
    </>}
    {!block&&text===undefined&&!web&&!loading&&<p>{label('missing')}</p>}
  </div>;
}
