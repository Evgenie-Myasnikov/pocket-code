import {useSyncExternalStore} from 'react';

export type JiraRole = 'developer'|'reviewer'|'qa';
const key='pocket-code-jira-role-v1',listeners=new Set<()=>void>();
let role:JiraRole='developer';
try {const saved=localStorage.getItem(key);if(saved==='reviewer'||saved==='qa')role=saved;}catch{/* Keep the default when storage is unavailable. */}
export function setJiraRole(next:JiraRole){
  role=next;try{localStorage.setItem(key,next);}catch{/* Keep this session's selection. */}
  listeners.forEach(listener=>listener());
}
export function useJiraRole(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},()=>role,()=> 'developer' as JiraRole);}
export const jiraRoleLabel=(role:JiraRole)=>({developer:'Developer',reviewer:'Reviewer',qa:'QA tester'}[role]);
export const jiraStartLabel=(role:JiraRole)=>({developer:'Start development',reviewer:'Start review',qa:'Start QA'}[role]);
