import {useEffect,useState} from 'react';
import {GitBranch} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import type {MarkdownChainSummary} from './markdown-chain';

type Membership=MarkdownChainSummary&{stepIndex:number};

export function ChatChainLink({connection,query,onOpen}:{connection:Connection;query:string;onOpen(id:string):void}){
  const [member,setMember]=useState<Membership>();
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
  return <button className="chat-task-entry" type="button" onClick={()=>onOpen(member.id)}>
      <GitBranch size={14} aria-hidden="true"/> {member.name} · {ru?'Шаг':'Step'} {member.stepIndex+1} / {member.stepCount}
  </button>;
}
