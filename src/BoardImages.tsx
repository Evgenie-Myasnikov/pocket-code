import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {request,fileBase64,type Connection} from './api';
import {ImageViewer} from './ImageViewer';
import {useLanguage} from './i18n';
import type {BoardNote} from '../server/boards';
import './board-images.css';

type Image=NonNullable<BoardNote['images']>[number];
function Thumbnail({connection,root,image,onOpen}:{connection:Connection;root:string;image:Image;onOpen(src:string):void}){
 const element=useRef<HTMLButtonElement>(null),[visible,setVisible]=useState(false),[src,setSrc]=useState(''),[error,setError]=useState('');
 const ru=useLanguage()==='ru';
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}});if(element.current)observer.observe(element.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!visible)return;let active=true;setSrc('');setError('');void request<{mimeType:string;data:string}>(connection,'/project-board/image?root='+encodeURIComponent(root)+'&path='+encodeURIComponent(image.path)).then(result=>{if(active)setSrc(`data:${result.mimeType};base64,${result.data}`);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[visible,root,image.path,connection.url,connection.token,connection.desktop]);
 return <button ref={element} type="button" className="board-image-thumb" disabled={!src} title={error||image.caption} aria-label={(ru?'Открыть изображение: ':'Open image: ')+image.caption} onClick={()=>onOpen(src)}>{src?<img src={src} alt={image.caption}/>:<span>{error?(ru?'Не удалось загрузить':'Could not load'):(ru?'Загрузка…':'Loading…')}</span>}<small>{image.caption}</small></button>;
}
export function BoardImages({connection,root,images=[],editable=false,onChange,onBusy}:{connection:Connection;root:string;images?:Image[];editable?:boolean;onChange?(images:Image[]):void;onBusy?(busy:boolean):void}){
 const ru=useLanguage()==='ru',[view,setView]=useState<{src:string;title:string}|null>(null),[error,setError]=useState(''),[uploading,setUploading]=useState(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;onBusy?.(false);};},[]);
 async function upload(files:FileList|null){
  if(!files?.length||!onChange||uploading)return;
  if(images.length+files.length>12){setError(ru?'Не больше 12 изображений':'Use up to 12 images');return;}
  setUploading(true);onBusy?.(true);setError('');
  const next=[...images];
  try{for(const file of Array.from(files)){
   if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error(ru?'Выберите PNG, JPEG или WebP':'Choose PNG, JPEG or WebP');
   const added=await request<Image>(connection,'/project-board/image',{root,data:await fileBase64(file),caption:file.name.slice(0,160)});
   if(!next.some(i=>i.path===added.path))next.push(added);
  }}catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current){onChange(next);setUploading(false);onBusy?.(false);}}
 }
 return <>{(images.length>0||editable)&&<div className="board-images" aria-label={ru?'Изображения идеи':'Idea images'}>{images.map((image,index)=><div className="board-image-item" key={image.path}><Thumbnail connection={connection} root={root} image={image} onOpen={src=>setView({src,title:image.caption})}/>{editable&&<button type="button" className="board-image-remove" aria-label={(ru?'Убрать изображение: ':'Remove image: ')+image.caption} onClick={()=>onChange?.(images.filter((_,i)=>i!==index))}>×</button>}</div>)}{editable&&<label className="board-image-upload">{ru?'Прикрепить изображения':'Attach images'}<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading||images.length>=12} onChange={e=>{void upload(e.target.files);e.target.value='';}}/><small>PNG, JPEG, WebP · 10 MB · {images.length}/12</small></label>}{uploading&&<p role="status">{ru?'Загрузка изображений…':'Uploading images…'}</p>}{error&&<p role="alert">{error}</p>}</div>}{view&&createPortal(<ImageViewer src={view.src} title={view.title} onClose={()=>setView(null)}/>,document.body)}</>;
}
