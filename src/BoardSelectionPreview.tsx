import {useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,ChevronDown,Image,Scan,X} from 'lucide-react';
import {request} from './api';
import {boardThumbnail,observeBoardImage} from './board-image-thumbnails';
import {imageBlob} from './image-thumbnails';
import type {BoardSelection,BoardSelectionObject} from './board-selection-context';
import {useBackAction} from './navigation';
import {t,useLanguage} from './i18n';
import './board-selection-preview.css';

function PreviewImage({selection,object}:{selection:BoardSelection;object:BoardSelectionObject}){
 const ref=useRef<HTMLSpanElement>(null),[visible,setVisible]=useState(false),[src,setSrc]=useState('');
 const image=object.images?.[0],connection=selection.connection;
 useEffect(()=>ref.current?observeBoardImage(ref.current,setVisible):undefined,[]);
 useEffect(()=>{
  setSrc('');if(!visible||!image)return;let active=true,url='';
  const key=JSON.stringify([connection.url,connection.token,Boolean(connection.desktop),selection.root,image.path,connection.workspaceId]);
  const cancel=boardThumbnail(key,async()=>{const result=await request<{mimeType:string;data:string}>(connection,'/project-board/image?'+new URLSearchParams({root:selection.root,path:image.path}));return imageBlob(`data:${result.mimeType};base64,${result.data}`);},blob=>{if(!active||!blob)return;url=URL.createObjectURL(blob);setSrc(url);});
  return()=>{active=false;cancel();if(url)URL.revokeObjectURL(url);};
 },[visible,image?.path,selection.root,connection.url,connection.token,connection.desktop,connection.workspaceId]);
 return <span ref={ref} className="board-selection-thumbnail" aria-hidden="true">{src?<img src={src} alt="" decoding="async"/>:<Image size={18}/>}</span>;
}
export function BoardSelectionPreview({selection,onReveal}:{selection:BoardSelection;onReveal?(id:string):void}){
 const ru=useLanguage()==='ru',trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),id=useId(),[open,setOpen]=useState(false),[place,setPlace]=useState<CSSProperties>({});
 const close=(restore=false)=>{setOpen(false);if(restore)trigger.current?.focus({preventScroll:true});};
 useBackAction(()=>{close(true);return true;},110,open);
 const identity=JSON.stringify([selection.boardId,selection.root,selection.connection.url,selection.connection.token,selection.connection.workspaceId]);
 useLayoutEffect(()=>setOpen(false),[identity]);
 useLayoutEffect(()=>{if(!open)return;const position=()=>{const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const width=Math.min(360,window.innerWidth-24),above=rect.top-16,below=window.innerHeight-rect.bottom-16;setPlace({width,left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),...(above>=Math.min(260,below)?{bottom:window.innerHeight-rect.top+8,maxHeight:Math.max(80,above)}:{top:rect.bottom+8,maxHeight:Math.max(80,below)})});};position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);};},[open]);
 useEffect(()=>{if(!open)return;panel.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close();},key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}};document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',key,true);};},[open]);
 const objects:BoardSelectionObject[]=selection.objects||selection.ids.map((objectId,index)=>({id:objectId,title:selection.titles[index]===objectId?'':selection.titles[index]||'',kind:'card'}));
 const kind=(value:string)=>(({card:ru?'Карточка':'Card',sticky:ru?'Стикер':'Sticky note',text:ru?'Текст':'Text',frame:ru?'Рамка':'Frame'} as Record<string,string>)[value]||(ru?'Объект':'Object'));
 if(!selection.ids.length)return null;
 return <><button ref={trigger} type="button" className="composer-board-selection" title={objects.map(object=>object.title||kind(object.kind)).join(' · ')} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(value=>!value)}><Scan size={16} aria-hidden="true"/><span>{t('Выделение доски')} · {selection.ids.length}</span><small>{t('К каждому сообщению')}</small><ChevronDown size={14} aria-hidden="true"/></button>
 {open&&createPortal(<div ref={panel} id={id} className="board-selection-preview" role="dialog" aria-label={ru?'Контекст сообщения':'Message context'} style={place} onBlur={event=>{const next=event.relatedTarget as Node|null;if(next&&!event.currentTarget.contains(next)&&!trigger.current?.contains(next))close();}}><header><div><strong>{ru?'Контекст сообщения':'Message context'}</strong>{selection.boardName&&<small>{selection.boardName}</small>}</div><button type="button" className="icon-button" aria-label={t('Закрыть')} onClick={()=>close(true)}><X size={16}/></button></header><p>{ru?'Выделение прикрепляется к каждому новому сообщению. Измените его на доске, чтобы изменить контекст.':'This selection is attached to each new message. Change it on the board to change the context.'}</p><ul>{objects.slice(0,80).map(object=><li key={object.id}>{object.images?.length?<PreviewImage selection={selection} object={object}/>:<span className="board-selection-thumbnail" aria-hidden="true"><Scan size={18}/></span>}<div><strong>{object.title||kind(object.kind)}</strong><small>{kind(object.kind)}</small></div>{onReveal&&<button type="button" className="icon-button" aria-label={(ru?'Показать на доске: ':'Show on board: ')+(object.title||kind(object.kind))} onClick={()=>{close();onReveal(object.id);}}><ArrowUpRight size={16}/></button>}</li>)}</ul>{objects.length>80&&<small className="board-selection-more">{ru?`Показаны 80 из ${objects.length}`:`Showing 80 of ${objects.length}`}</small>}</div>,document.body)}</>;
}
