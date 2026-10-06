import {useEffect,useState} from 'react';
import {ApprovalCard} from '../../src/Messages';
import {useBackNavigation} from '../../src/navigation';
import type {Approval} from '../../server/types';
export function QuestionsHarness(){
 const [approval,setApproval]=useState<Approval|null>(null),[provider,setProvider]=useState<'claude'|'codex'|'copilot'>('claude');
 useBackNavigation();
 useEffect(()=>{(window as any).questionAnswers=[];(window as any).askSynthetic=(questions:unknown[],engine='claude',expires=60000)=>{setProvider(engine as any);setApproval({id:crypto.randomUUID(),tool:'AskUserQuestion',input:{questions},expiresAt:Date.now()+expires});};},[]);
 return <main><button>Background control</button>{approval&&<ApprovalCard key={approval.id} approval={approval} provider={provider} decide={async(allow,answers)=>{
  await new Promise(resolve=>setTimeout(resolve,30));
  if((window as any).failQuestion)throw Error('Synthetic network failure');
  (window as any).questionAnswers.push({allow,answers});setApproval(null);
 }}/>}</main>;
}
