import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {Minus,Plus,RotateCcw,X} from 'lucide-react';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import './image-viewer.css';

type Point={x:number;y:number};
type View=Point&{scale:number};
const fitted:View={x:0,y:0,scale:1};
export function ImageViewer({src,title,onClose,children}:{src?:string;title:string;onClose:()=>void;children?:ReactNode}){
  const ru=useLanguage()==='ru',overlay=useRef<HTMLDivElement|null>(null),stage=useRef<HTMLDivElement|null>(null),image=useRef<HTMLImageElement|null>(null);
  useModal(overlay,true,onClose);
  const [view,setView]=useState<View>(fitted),[size,setSize]=useState({width:0,height:0}),[failed,setFailed]=useState(false),[ready,setReady]=useState(false);
  const latest=useRef(view),natural=useRef({width:0,height:0}),base=useRef(size),frame=useRef(0),points=useRef(new Map<number,Point>());
  const gesture=useRef<{view:View;center:Point;distance:number}|null>(null);
  const constrain=(next:View)=>{
    const scale=Math.max(1,Math.min(8,next.scale)),box=stage.current;
    const maxX=Math.max(0,(base.current.width*scale-(box?.clientWidth||0))/2),maxY=Math.max(0,(base.current.height*scale-(box?.clientHeight||0))/2);
    return {scale,x:Math.max(-maxX,Math.min(maxX,next.x)),y:Math.max(-maxY,Math.min(maxY,next.y))};
  };
  function update(next:View){latest.current=constrain(next);if(!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;setView(latest.current);});}
  function resize(){const box=stage.current,n=natural.current;if(!box||!n.width||!n.height)return;const fit=Math.min(box.clientWidth/n.width,box.clientHeight/n.height);base.current={width:n.width*fit,height:n.height*fit};setSize(base.current);update(latest.current);}
  function zoom(scale:number,center:Point={x:0,y:0}){const old=latest.current,ratio=Math.max(1,Math.min(8,scale))/old.scale;update({scale,x:center.x-(center.x-old.x)*ratio,y:center.y-(center.y-old.y)*ratio});}
  useLayoutEffect(()=>{setReady(false);setFailed(false);natural.current={width:0,height:0};latest.current=fitted;setView(fitted);points.current.clear();gesture.current=null;},[src]);
  useLayoutEffect(()=>{const element=stage.current;if(!element)return;const observer=new ResizeObserver(resize);observer.observe(element);return()=>{observer.disconnect();cancelAnimationFrame(frame.current);frame.current=0;};},[]);
  useEffect(()=>{const element=stage.current;if(!element)return;const wheel=(event:WheelEvent)=>{if(!natural.current.width)return;event.preventDefault();const box=element.getBoundingClientRect();zoom(latest.current.scale*Math.exp(-event.deltaY*.002),{x:event.clientX-box.left-box.width/2,y:event.clientY-box.top-box.height/2});};element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);},[]);
  function resetGesture(){const active=[...points.current.values()];if(!active.length){gesture.current=null;return;}const center=active.length>1?{x:(active[0].x+active[1].x)/2,y:(active[0].y+active[1].y)/2}:active[0];gesture.current={view:latest.current,center,distance:active.length>1?Math.hypot(active[0].x-active[1].x,active[0].y-active[1].y):0};}
  function point(event:{clientX:number;clientY:number}):Point{const box=stage.current!.getBoundingClientRect();return {x:event.clientX-box.left-box.width/2,y:event.clientY-box.top-box.height/2};}
  const end=(id:number)=>{points.current.delete(id);resetGesture();};
  return <div ref={overlay} className="image-overlay image-viewer" role="dialog" aria-modal="true" aria-label={ru?'Изображение':'Image'}>
    <header className="image-viewer-toolbar"><strong title={title}>{title}</strong><button className="icon-button" aria-label={ru?'Закрыть':'Close'} onClick={onClose}><X size={21}/></button></header>
    <div ref={stage} className="image-viewer-stage" data-zoom={view.scale.toFixed(2)} onDoubleClick={event=>{if(ready)zoom(latest.current.scale>1?1:2,point(event));}}
      onPointerDown={event=>{if(!ready||event.button!==0||points.current.size>=2)return;event.currentTarget.setPointerCapture(event.pointerId);points.current.set(event.pointerId,point(event));resetGesture();}}
      onPointerMove={event=>{if(!points.current.has(event.pointerId))return;points.current.set(event.pointerId,point(event));const start=gesture.current;if(!start)return;const active=[...points.current.values()],center=active.length>1?{x:(active[0].x+active[1].x)/2,y:(active[0].y+active[1].y)/2}:active[0];const ratio=active.length>1&&start.distance?Math.hypot(active[0].x-active[1].x,active[0].y-active[1].y)/start.distance:1;const scale=Math.max(1,Math.min(8,start.view.scale*ratio)),adjusted=scale/start.view.scale;update({scale,x:center.x-(start.center.x-start.view.x)*adjusted,y:center.y-(start.center.y-start.view.y)*adjusted});}}
      onPointerUp={event=>end(event.pointerId)} onPointerCancel={event=>end(event.pointerId)} onLostPointerCapture={event=>end(event.pointerId)}>
      {src&&!failed?<><img ref={image} className="image-viewer-image" src={src} alt={title} draggable={false} referrerPolicy="no-referrer" onLoad={event=>{natural.current={width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight};setReady(true);resize();}} onError={()=>{setFailed(true);setReady(false);}} style={{width:size.width||undefined,height:size.height||undefined,marginLeft:-size.width/2,marginTop:-size.height/2,visibility:ready?'visible':'hidden',transform:`translate3d(${view.x}px,${view.y}px,0) scale(${view.scale})`}}/>{!ready&&<p role="status">{ru?'Загрузка…':'Loading…'}</p>}</>:failed?<p role="status">{ru?'Не удалось показать изображение':'Could not display this image'}</p>:children}
    </div>
    <footer className="image-viewer-controls"><button className="icon-button" disabled={!ready||view.scale<=1} aria-label={ru?'Уменьшить':'Zoom out'} onClick={()=>zoom(latest.current.scale/1.5)}><Minus size={20}/></button><output aria-label={ru?'Масштаб':'Zoom'}>{view.scale.toFixed(1)}×</output><button className="icon-button" disabled={!ready||view.scale>=8} aria-label={ru?'Увеличить':'Zoom in'} onClick={()=>zoom(latest.current.scale*1.5)}><Plus size={20}/></button><button className="image-viewer-fit" disabled={!ready} onClick={()=>update(fitted)}><RotateCcw size={17}/>{ru?'По экрану':'Fit to screen'}</button></footer>
  </div>;
}
