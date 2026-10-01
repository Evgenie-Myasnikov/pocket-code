import {useRef} from 'react';
import {t} from './i18n';

export function ActivityHandle({count,disabled,onOpen,onDrag,onDragEnd}:{count:number;disabled:boolean;onOpen:()=>void;onDrag?:(distance:number)=>void;onDragEnd?:(open:boolean)=>void}){
  const gesture=useRef<{id:number;x:number;y:number;started:number;dragging:boolean}|null>(null);
  const suppressClick=useRef(false);
  return <button className="activity-entry" aria-label={t('Активность чатов')}
    aria-description={t('Чатов в активности: {0}',count)} aria-haspopup="dialog"
    title={t('Активность чатов')} disabled={disabled}
    onPointerDown={event=>{
      if(!event.isPrimary||event.button!==0)return;
      gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,started:performance.now(),dragging:false};
      suppressClick.current=false;event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event=>{
      const start=gesture.current;if(!start||start.id!==event.pointerId)return;
      const left=start.x-event.clientX,vertical=Math.abs(event.clientY-start.y);
      if(!start.dragging&&left>8&&left>vertical*1.3)start.dragging=true;
      if(start.dragging){suppressClick.current=true;onDrag?.(Math.max(0,left));}
    }}
    onPointerUp={event=>{
      const start=gesture.current;if(!start||start.id!==event.pointerId)return;
      gesture.current=null;
      const left=start.x-event.clientX,vertical=Math.abs(event.clientY-start.y);
      suppressClick.current=start.dragging||Math.abs(left)>10||vertical>10;
      if(start.dragging){onDragEnd?.(left>=56||(left>=20&&left/Math.max(1,performance.now()-start.started)>.35));}
      else if(left>=26&&vertical<left*.65)onOpen();
    }}
    onPointerCancel={()=>{if(gesture.current?.dragging)onDragEnd?.(false);gesture.current=null;suppressClick.current=true;}}
    onClick={event=>{if(event.detail===0||!suppressClick.current)onOpen();suppressClick.current=false;}}>
    <span className="activity-handle-line" aria-hidden="true"/>
  </button>;
}
