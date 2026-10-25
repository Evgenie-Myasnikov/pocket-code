import {boardThumbnail,observeBoardImage} from './board-image-thumbnails';
import {imageBlob} from './image-thumbnails';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {request,fileBase64,type Connection} from './api';
import {ImageViewer} from './ImageViewer';
import {useLanguage,t} from './i18n';
import {Paperclip,X} from 'lucide-react';
import type {BoardNote} from '../server/boards';
import './board-images.css';

type Image=NonNullable<BoardNote['images']>[number];
function Thumbnail({connection,root,image,onOpen}:{connection:Connection;root:string;image:Image;onOpen(src:string):void}){
 const element=useRef<HTMLButtonElement>(null),[visible,setVisible]=useState(false),[src,setSrc]=useState(''),[error,setError]=useState('');
 const ru=useLanguage()==='ru';
 useEffect(()=>element.current?observeBoardImage(element.current,setVisible):undefined,[]);
 useEffect(()=>{
  setSrc('');setError('');if(!visible)return;let url='',active=true;
  const key=JSON.stringify([connection.url,connection.token,Boolean(connection.desktop),root,image.path]);
  const cancel=boardThumbnail(key,async()=>{const result=await request<{mimeType:string;data:string}>(connection,'/project-board/image?root='+encodeURIComponent(root)+'&path='+encodeURIComponent(image.path));return imageBlob(`data:${result.mimeType};base64,${result.data}`);},blob=>{if(!active)return;if(blob){url=URL.createObjectURL(blob);setSrc(url);}else setError(ru?'Не удалось загрузить':'Could not load');});
  return()=>{active=false;cancel();if(url)URL.revokeObjectURL(url);};
 },[visible,root,image.path,connection.url,connection.token,connection.desktop]);
 return <button ref={element} type="button" className="board-image-thumb" disabled={!src} title={error||image.caption} aria-label={(ru?'Открыть изображение: ':'Open image: ')+image.caption} onClick={()=>onOpen(src)}>{src?<img src={src} alt={image.caption} decoding="async" draggable={false}/>:<span>{error?(ru?'Не удалось загрузить':'Could not load'):(ru?'Загрузка…':'Loading…')}</span>}<small>{image.caption}</small></button>;
}
export function BoardImages({connection,root,images=[],editable=false,onChange,onBusy}:{connection:Connection;root:string;images?:Image[];editable?:boolean;onChange?(images:Image[]):void;onBusy?(busy:boolean):void}){
 const ru=useLanguage()==='ru',[view,setView]=useState<{src:string;title:string}|null>(null),[error,setError]=useState(''),[uploading,setUploading]=useState(false),[dropping,setDropping]=useState(false),alive=useRef(true),picker=useRef<HTMLInputElement>(null),viewerRequest=useRef(0);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;onBusy?.(false);};},[]);
 function openImage(image:Image,thumbnail:string){
  const current=++viewerRequest.current;setView({src:thumbnail,title:image.caption});
  void request<{mimeType:string;data:string}>(connection,'/project-board/image?root='+encodeURIComponent(root)+'&path='+encodeURIComponent(image.path)).then(result=>{if(alive.current&&viewerRequest.current===current)setView({src:`data:${result.mimeType};base64,${result.data}`,title:image.caption});}).catch(()=>{});
 }
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
 const full=uploading||images.length>=12;
 return <>{(images.length>0||editable)&&<div className={'board-images'+(dropping?' board-images-drop':'')} aria-label={ru?'Изображения идеи':'Idea images'} onDragOver={editable&&!full?e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();setDropping(true);}}:undefined} onDragLeave={()=>setDropping(false)} onDrop={editable&&!full?e=>{e.preventDefault();setDropping(false);void upload(e.dataTransfer.files);}:undefined}>{images.map((image,index)=><div className="board-image-item" key={image.path}><Thumbnail connection={connection} root={root} image={image} onOpen={src=>openImage(image,src)}/>{editable&&<button type="button" className="board-image-remove" aria-label={(ru?'Убрать изображение: ':'Remove image: ')+image.caption} onClick={()=>onChange?.(images.filter((_,i)=>i!==index))}><span aria-hidden="true"><X size={16}/></span></button>}</div>)}{editable&&<div className="board-image-upload"><input ref={picker} type="file" hidden tabIndex={-1} aria-hidden="true" accept="image/png,image/jpeg,image/webp" multiple disabled={full} onChange={e=>{void upload(e.target.files);e.target.value='';}}/><button type="button" disabled={full} onClick={()=>picker.current?.click()}><Paperclip size={16} aria-hidden="true"/>{ru?'Прикрепить изображения':'Attach images'}</button><small>{t('PNG, JPEG, WebP · до 10 МБ · {0}/12',images.length)}{!full&&<span className="board-image-drop-hint"> · {t('можно перетащить сюда')}</span>}</small></div>}{uploading&&<p role="status">{ru?'Загрузка изображений…':'Uploading images…'}</p>}{error&&<p role="alert">{error}</p>}</div>}{view&&createPortal(<ImageViewer src={view.src} title={view.title} onClose={()=>{viewerRequest.current++;setView(null);}}/>,document.body)}</>;
}
