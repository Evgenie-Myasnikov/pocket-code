import {useEffect,useState} from 'react';
import {request,type Connection} from './api';
import {t} from './i18n';
import type {TaskRun,TaskStage} from '../server/task-runs';
export type {TaskRun};
/** One stage vocabulary for the board card, the gallery, the chat chip and the task result. "Prepared" is derived: a worktree exists and nothing has been sent yet. */
export type TaskDisplayStage=TaskStage|'prepared';
const labels:Record<TaskDisplayStage,string>={prepared:'Подготовлено',questions:'Ждёт вас',working:'Работа',checks:'Проверки',review:'К ревью',approved:'Одобрено',failed:'Ошибка'};
export const taskDisplayStage=(run:Pick<TaskRun,'stage'|'jobs'>):TaskDisplayStage=>run.stage==='working'&&!run.jobs.length?'prepared':run.stage;
export function taskStageLabel(stage:TaskDisplayStage,_ru?:boolean){return t(labels[stage]);}
export const taskRunStageLabel=(run:Pick<TaskRun,'stage'|'jobs'>)=>taskStageLabel(taskDisplayStage(run));
/** Pipeline position for the stepper; "Needs you" and "Failed" are deviations shown on the current step. */
export const taskPipeline=['working','checks','review','approved'] as const;
export function taskPipelineStep(run:Pick<TaskRun,'stage'|'jobs'|'verification'>){
  const stage=run.stage;if(stage==='working'||stage==='questions')return 0;if(stage==='checks')return 1;if(stage==='review')return 2;if(stage==='approved')return 3;
  return run.verification?1:0;
}
export const providerName=(provider:string)=>provider==='claude'?'Claude Code':provider==='copilot'?'GitHub Copilot':provider==='codex'?'Codex':provider;
const checkLabels:Record<string,string>={passed:'Пройдено',failed:'Не пройдено',running:'Выполняется',interrupted:'Прервано',timeout:'Превышено время'};
export const checkStatusLabel=(status:string)=>checkLabels[status]?t(checkLabels[status]):status;
/** The newest run per note; the board shows only that stage. */
export function latestRuns(runs:TaskRun[]){const latest=new Map<string,TaskRun>();for(const run of runs){const key=run.boardId+'/'+run.noteId,known=latest.get(key);if(!known||run.createdAt>known.createdAt)latest.set(key,run);}return latest;}
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
