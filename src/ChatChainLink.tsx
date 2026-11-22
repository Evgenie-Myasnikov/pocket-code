import {useEffect,useState} from 'react';
import {GitBranch} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {MarkdownChainPanel,type MarkdownChainControls} from './MarkdownChainPanel';
import type {MarkdownChainSummary} from './markdown-chain';

type Membership=MarkdownChainSummary&{stepIndex:number};

export function ChatChainLink({connection,query,controls}:{connection:Connection;query:string;controls:MarkdownChainControls}){
  const [member,setMember]=useState<Membership>();
  const [open,setOpen]=useState(false);
  const ru=useLanguage()==='ru';
  useEffect(()=>{
    let active=true;
    request<Membership[]>(connection,'/task-chains?'+query).then(matches=>{
      const match=matches[0];
      if(active&&Number.isInteger(match?.stepIndex))setMember(match);
    }).catch(()=>{/* Existing histories also open on hosts without task chains. */});
    return ()=>{active=false;};
  },[connection,query]);
  if(!member)return null;
  return <>
    <button className="chat-task-entry" type="button" onClick={()=>setOpen(true)}>
      <GitBranch size={14} aria-hidden="true"/> {member.name} · {ru?'Шаг':'Step'} {member.stepIndex+1} / {member.stepCount}
    </button>
    {open&&<MarkdownChainPanel controls={controls} initialId={member.id} onClose={()=>setOpen(false)}/>}
  </>;
}
