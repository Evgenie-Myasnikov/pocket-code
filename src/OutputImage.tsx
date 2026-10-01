import {useEffect,useRef,useState} from 'react';
import {Image,CloudDownload} from 'lucide-react';
import {request,type Connection} from './api';
import {imageSource,safeWebUrl} from './RichBlocks';
import {ImageViewer} from './ImageViewer';
import {imageBlob,type ThumbnailQueue} from './image-thumbnails';
import {useLanguage} from './i18n';
import type {ChatOutput} from './chat-outputs';

type Props={output:ChatOutput;title:string;connection:Connection;cwd:string};
async function localSource(connection:Connection,cwd:string,path:string){
  const artifact=await request<{name:string;mimeType:string;data?:string}>(connection,`/project-artifact?cwd=${encodeURIComponent(cwd)}&path=${encodeURIComponent(path)}`);
  const src=imageSource({type:'image',source:{type:'base64',media_type:artifact.mimeType,data:artifact.data}});
  if(!src?.startsWith('data:'))throw Error('This file is not a supported image');
  return src;
}
export function OutputImageCard({output,title,connection,cwd,queue,onOpen}:{queue:ThumbnailQueue;onOpen:()=>void}&Props){
  const ru=useLanguage()==='ru',element=useRef<HTMLButtonElement|null>(null),[near,setNear]=useState(false),[src,setSrc]=useState<string|null>(null),[failed,setFailed]=useState(false);
  const remote=!!safeWebUrl(output.href||output.block?.source?.url);
  useEffect(()=>{const node=element.current;if(!node)return;const observer=new IntersectionObserver(entries=>setNear(entries.some(entry=>entry.isIntersecting)),{root:node.closest('.chat-outputs-scroll'),rootMargin:'64px'});observer.observe(node);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    if(!near||remote)return;let active=true,objectUrl:string|null=null;setFailed(false);
    const cancel=queue.enqueue(async()=>{
      const source=output.path?await localSource(connection,cwd,output.path):output.block?imageSource(output.block):null;
      if(!source)throw Error('Missing image');return imageBlob(source);
    },url=>{if(active){objectUrl=url;setSrc(url);setFailed(!url);}else if(url)URL.revokeObjectURL(url);});
    return()=>{active=false;cancel();if(objectUrl)URL.revokeObjectURL(objectUrl);setSrc(null);};
  },[near,remote,queue,connection,cwd,output.path,output.block]);
  return <button ref={element} className="chat-output-image-card" aria-label={title} onClick={onOpen}>
    <span className="chat-output-image-frame">{src?<img src={src} alt="" decoding="async"/>:<><Image size={30}/><small>{remote?<><CloudDownload size={15}/>{ru?'Внешнее изображение':'External image'}</>:failed?(ru?'Нажмите для просмотра':'Tap to view'):ru?'Предпросмотр…':'Preview…'}</small></>}</span>
    <strong>{title}</strong>
  </button>;
}
export function OutputImageViewer({output,title,connection,cwd,onClose}:Props&{onClose:()=>void}){
  const ru=useLanguage()==='ru',[src,setSrc]=useState<string|undefined>(),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[accepted,setAccepted]=useState(false);
  const remote=safeWebUrl(output.href||output.block?.source?.url);
  useEffect(()=>{
    let active=true;setSrc(undefined);setError('');
    if(remote){if(accepted)setSrc(remote);return;}
    if(output.path)void localSource(connection,cwd,output.path).then(value=>{if(active)setSrc(value);}).catch(reason=>{if(active)setError(reason.message);});
    else{const value=output.block?imageSource(output.block):null;if(value)setSrc(value);else setError(ru?'Изображение недоступно':'Image unavailable');}
    return()=>{active=false;};
  },[connection,cwd,output,remote,accepted,attempt,ru]);
  return <ImageViewer src={src} title={title} onClose={onClose}><div className="image-viewer-message">
    {remote&&!accepted?<><p>{ru?'Внешнее изображение загрузится только по вашему нажатию.':'The external image loads only when you choose.'}</p><button className="secondary" onClick={()=>setAccepted(true)}>{ru?'Загрузить внешнее изображение':'Load external image'}</button></>:error?<><p role="status">{error}</p><button className="secondary" onClick={()=>setAttempt(value=>value+1)}>{ru?'Повторить загрузку':'Retry preview'}</button></>:<p role="status">{ru?'Загрузка…':'Loading…'}</p>}
  </div></ImageViewer>;
}
