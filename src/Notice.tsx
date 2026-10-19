import type {ReactNode} from 'react';
import {AlertCircle,AlertTriangle,CheckCircle2,Info} from 'lucide-react';
import './notice.css';

export type NoticeTone='info'|'success'|'warning'|'error';
const icons={info:Info,success:CheckCircle2,warning:AlertTriangle,error:AlertCircle};
/** One look for settings statuses: tone colour is always repeated by an icon and the text; the fix sits inside the notice. */
export function Notice({tone='info',title,children,action,id,live=true}:{tone?:NoticeTone;title?:ReactNode;children?:ReactNode;action?:ReactNode;id?:string;live?:boolean}){
  const Icon=icons[tone];
  return <div className={'notice notice-'+tone} id={id} role={live?tone==='error'?'alert':'status':undefined}><Icon className="notice-icon" size={20} aria-hidden="true"/><div className="notice-body">{title&&<strong>{title}</strong>}{children&&<div>{children}</div>}{action&&<div className="notice-actions">{action}</div>}</div></div>;
}
