import {useId,useState,type ReactNode} from 'react';
import {CircleHelp} from 'lucide-react';
import './settings-cards.css';

/** A titled group of settings: a small heading and one rounded card holding rows separated by thin lines. */
export function SettingsBlock({title,action,children,className,label}:{title?:ReactNode;action?:ReactNode;children:ReactNode;className?:string;label?:string}){
  const id=useId();
  return <section className={'settings-block'+(className?' '+className:'')} aria-labelledby={title?id:undefined} aria-label={title?undefined:label}>
    {(title||action)&&<header className="settings-block-head">{title&&<h3 id={id}>{title}</h3>}{action}</header>}
    <div className="settings-card">{children}</div>
  </section>;
}
/** A rarely needed explanation: an icon button that opens one short paragraph under the row title. */
export function HelpTip({label,children}:{label:string;children:ReactNode}){
  const [open,setOpen]=useState(false),id=useId();
  return <span className="settings-help"><button type="button" className="icon-button settings-help-toggle" aria-label={label} title={label} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}><CircleHelp size={16} aria-hidden="true"/></button><span id={id} className="settings-help-text" role="note" hidden={!open}>{children}</span></span>;
}
/** One settings row: a bold name and at most one muted line on the left, the control on the right. */
export function SettingRow({title,note,help,htmlFor,titleId,noteId,children,wide,className}:{title:ReactNode;note?:ReactNode;help?:ReactNode;htmlFor?:string;titleId?:string;noteId?:string;children?:ReactNode;wide?:boolean;className?:string}){
  return <div className={'settings-row'+(wide?' wide':'')+(className?' '+className:'')}>
    <div className="settings-row-text">
      <span className="settings-row-title">{htmlFor?<label htmlFor={htmlFor} id={titleId}>{title}</label>:<strong id={titleId}>{title}</strong>}{help}</span>
      {note&&<small id={noteId}>{note}</small>}
    </div>
    {children!==undefined&&children!==null&&children!==false&&<div className="settings-row-control">{children}</div>}
  </div>;
}
/** A row whose control is an on/off switch; the title is the switch's name and the note its description. */
export function SwitchRow({title,note,help,checked,disabled,onChange}:{title:string;note?:ReactNode;help?:ReactNode;checked:boolean;disabled?:boolean;onChange(checked:boolean):void}){
  const id=useId();
  return <SettingRow title={title} note={note} help={help} htmlFor={id} noteId={id+'-note'}>
    <input id={id} className="settings-switch" type="checkbox" role="switch" checked={checked} disabled={disabled} aria-describedby={note?id+'-note':undefined} onChange={event=>onChange(event.target.checked)}/>
  </SettingRow>;
}
/** A full-width line inside a card for a status, a notice or an inline confirmation. */
export function SettingsLine({children,className}:{children:ReactNode;className?:string}){
  return <div className={'settings-row settings-line'+(className?' '+className:'')}>{children}</div>;
}
