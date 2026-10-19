import {useId} from 'react';
import {ShieldAlert} from 'lucide-react';
import './codex-access.css';

export type AccessOption<T extends string>={value:T;label:string;consequence:string;risky?:boolean};
/** One card per access mode: the title is the radio's name, the always-visible consequence line is its description, and the mode that lifts all checks is marked as a warning. */
export function AccessOptions<T extends string>({name,value,options,onChange,describedBy}:{name?:string;value:T;options:AccessOption<T>[];onChange(value:T):void;describedBy?:string}){
  const generated=useId(),group=name||generated;
  return <div className="codex-access-options">{options.map(option=>{const id=`${generated}-${option.value}`;return <div key={option.value} className={'access-option'+(option.value===value?' selected':'')+(option.risky?' risky':'')}>
    <label><input type="radio" name={group} value={option.value} checked={option.value===value} onChange={()=>onChange(option.value)} aria-describedby={[id,describedBy].filter(Boolean).join(' ')}/><span className="access-option-title">{option.risky&&<ShieldAlert size={17} aria-hidden="true"/>}{option.label}</span></label>
    <small id={id}>{option.consequence}</small>
  </div>;})}</div>;
}
