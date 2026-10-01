import {useRef} from 'react';
import {t} from './i18n';

export function ActivityHandle({count,disabled,onOpen}:{count:number;disabled:boolean;onOpen:()=>void}){
  const gesture=useRef<{id:number;x:number;y:number}|null>(null);
  const suppressClick=useRef(false);
  return <button className="activity-entry" aria-label={t('Активность чатов')}
    aria-description={t('Чатов в активности: {0}',count)} aria-haspopup="dialog"
    title={t('Активность чатов')} disabled={disabled}
    onPointerDown={event=>{
      if(!event.isPrimary||event.button!==0)return;
      gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY};
      suppressClick.current=false;event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerUp={event=>{
      const start=gesture.current;if(!start||start.id!==event.pointerId)return;
      gesture.current=null;
      const left=start.x-event.clientX,vertical=Math.abs(event.clientY-start.y);
      suppressClick.current=Math.abs(left)>10||vertical>10;
      if(left>=26&&vertical<left*.65)onOpen();
    }}
    onPointerCancel={()=>{gesture.current=null;suppressClick.current=true;}}
    onClick={event=>{if(event.detail===0||!suppressClick.current)onOpen();suppressClick.current=false;}}>
    <span className="activity-handle-line" aria-hidden="true"/>
  </button>;
}
