import {useEffect,useState} from 'react';
import {request,type Connection} from './api';
import type {TaskRun,TaskStage} from '../server/task-runs';
export type {TaskRun};
export function taskStageLabel(stage:TaskStage,ru:boolean){
  const labels:Record<TaskStage,[string,string]>={questions:['Needs an answer','Нужен ответ'],working:['Work','Работа'],checks:['Checks','Проверки'],review:['Review','Ревью'],approved:['Approved','Одобрено'],failed:['Failed','Ошибка']};
  return labels[stage][ru?1:0];
}
/** Lookup is scoped to one PC and one chat; stale responses never cross navigation. */
export function useTaskRun(connection:Connection|null,provider:string,cwd:string,jobId?:string,sessionId?:string,initial?:TaskRun){
  const [value,setValue]=useState<{key:string;run:TaskRun|null}|null>(null);
  const key=JSON.stringify([connection?.url,connection?.token,provider,cwd,jobId,sessionId]);
  const seed=initial?.provider===provider&&initial.worktree?.cwd===cwd?initial:null;
  useEffect(()=>{
    if(!connection||connection.workspaceId||!jobId&&!sessionId&&!seed)return;let active=true,inFlight=false;
    const load=async()=>{if(inFlight)return;inFlight=true;try{
      const query=new URLSearchParams({provider,...(jobId?{jobId}:sessionId?{sessionId}:{})});
      const runs=seed?[await request<TaskRun>(connection,'/task-runs/'+seed.id)]:(await request<{runs:TaskRun[]}>(connection,'/task-runs?'+query)).runs;
      if(active)setValue({key,run:runs.find(run=>run.worktree?.cwd===cwd)||null});
    }catch{/* A transient outage preserves this chat's last known link. */}finally{inFlight=false;}};
    void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},3000);
    return()=>{active=false;clearInterval(timer);};
  },[key]);
  return value?.key===key?value.run||seed:seed;
}
