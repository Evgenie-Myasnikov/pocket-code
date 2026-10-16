import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {FileText,Image as ImageIcon,X} from 'lucide-react';
import type {Block} from '../server/types';
import {request,type Connection} from './api';
import {imageSource,RichBlock,Markdown} from './RichBlocks';
import {ImageViewer} from './ImageViewer';
import {imageBlob,thumbnailQueue} from './image-thumbnails';
import {useModal} from './navigation';
import {useLanguage} from './i18n';

const thumbnails=thumbnailQueue(2);
type Artifact={name:string;mimeType:string;data?:string;text?:string};
export function MessageAttachment({block,connection,cwd}:{block:Block;connection?:Connection|null;cwd?:string}){
  const ru=useLanguage()==='ru',ref=useRef<HTMLButtonElement>(null),[near,setNear]=useState(false),[thumb,setThumb]=useState<string|null>(null),[open,setOpen]=useState(false),[remoteAccepted,setRemoteAccepted]=useState(false);
  const title=block.title||block.attachmentPath?.split(/[\\/]/).pop()||(ru?'Вложение':'Attachment');
  const isImage=block.type==='image'||/\.(png|jpe?g|gif|webp)$/i.test(block.attachmentPath||'');
  const [artifact,setArtifact]=useState<Artifact|null>(null),[error,setError]=useState('');
  const load=async()=>{
    if(!block.attachmentPath||!connection||!cwd)throw Error(ru?'Файл недоступен на подключённом ПК':'File unavailable on the connected PC');
    return request<Artifact>(connection,`/message-attachment?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(block.attachmentPath)}`);
  };
  useEffect(()=>{const node=ref.current;if(!node||!isImage)return;const observer=new IntersectionObserver(entries=>setNear(entries.some(entry=>entry.isIntersecting)),{root:node.closest('.conversation'),rootMargin:'64px'});observer.observe(node);return()=>observer.disconnect();},[isImage]);
  useEffect(()=>{
    if(!near||!isImage)return;let objectUrl:string|null=null;
    const cancel=thumbnails.enqueue(async()=>{let src=imageSource(block);if(!src&&block.attachmentPath){const file=await load();src=imageSource({type:'image',data:file.data,mimeType:file.mimeType});}if(!src?.startsWith('data:'))throw Error('External image requires explicit loading');return imageBlob(src);},url=>{objectUrl=url;setThumb(url);});
    return()=>{cancel();if(objectUrl)URL.revokeObjectURL(objectUrl);setThumb(null);};
  },[near,isImage,block.attachmentPath,block.source?.data,block.source?.url,block.source?.media_type,block.data,block.mimeType,connection?.url,connection?.token,cwd]);
  useEffect(()=>{if(!open)return;let active=true;setError('');setArtifact(null);if(block.attachmentPath&&!imageSource(block))void load().then(value=>{if(active)setArtifact(value);}).catch(reason=>{if(active)setError(reason.message);});return()=>{active=false;};},[open,block.attachmentPath,block.source?.data,block.source?.url,block.data,connection?.url,connection?.token,cwd]);
  const original=imageSource(block);
  const full=(original?.startsWith('data:')||remoteAccepted?original:null)|| (artifact?imageSource({type:'image',data:artifact.data,mimeType:artifact.mimeType}):null);
  return <><button ref={ref} className={`message-attachment ${isImage?'message-attachment-image':''}`} aria-label={`${ru?'Открыть':'Open'} ${title}`} title={title} onClick={()=>setOpen(true)}>{isImage?thumb?<img src={thumb} alt=""/>:<ImageIcon size={25}/>:<><FileText size={22}/><span>{title}</span></>}</button>{open&&createPortal(isImage?<ImageViewer src={full||undefined} title={title} onClose={()=>setOpen(false)}><div className="image-viewer-message">{error?<p role="status">{error}</p>:block.source?.url?<button className="secondary" onClick={()=>setRemoteAccepted(true)}>{ru?'Загрузить внешнее изображение':'Load external image'}</button>:<p role="status">{ru?'Загрузка…':'Loading…'}</p>}</div></ImageViewer>:<AttachmentDocument title={title} onClose={()=>setOpen(false)}>{error?<p role="status">{error}</p>:artifact?.text!==undefined?<Markdown text={artifact.text}/>:artifact?<RichBlock block={{type:'document',title,source:{media_type:artifact.mimeType,data:artifact.data}}}/>:block.type==='document'?<RichBlock block={block}/>:<p role="status">{ru?'Загрузка…':'Loading…'}</p>}</AttachmentDocument>,document.body)}</>;
}
function AttachmentDocument({title,onClose,children}:{title:string;onClose():void;children:React.ReactNode}){
  const ref=useRef<HTMLElement>(null),ru=useLanguage()==='ru';useModal(ref,true,onClose);
  return <section ref={ref} className="attachment-document-viewer" role="dialog" aria-modal="true" aria-label={title}><header><strong>{title}</strong><button className="icon-button" aria-label={ru?'Закрыть':'Close'} onClick={onClose}><X size={22}/></button></header><div>{children}</div></section>;
}
