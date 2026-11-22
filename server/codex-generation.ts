import type {JobView} from './types.js';

const count=(n:unknown):n is number=>Number.isSafeInteger(n)&&(n as number)>=0;
type Generation=NonNullable<JobView['generation']>;

/** One Codex turn may issue several inference requests. The app-server's total usage spans the entire thread. */
export class CodexTurnGeneration {
  private baseline?:number;
  private lastTotal?:number;
  private firstOutput?:number;
  private lastOutput?:number;
  private lastUsage?:number;
  private pendingTiming=false;
  private sawReasoning=false;
  private hiddenReasoning=false;
  private readonly items=new Set<string>();

  modelItem(item:{id?:unknown;type?:string;startedAtMs?:unknown;completedAtMs?:unknown},completed:boolean,receivedAt:number,stats?:Generation){
    if(!item||!['agentMessage','reasoning','plan'].includes(item.type||'')||typeof item.id!=='string')return;
    if(this.pendingTiming&&!this.items.has(item.id))this.resetTime();
    this.items.add(item.id);
    if(item.type==='reasoning')this.sawReasoning=true;
    const start=count(item.startedAtMs)?item.startedAtMs:!completed?receivedAt:undefined;
    if(start!==undefined)this.firstOutput=Math.min(this.firstOutput??start,start);
    if(completed){
      this.lastOutput=count(item.completedAtMs)?item.completedAtMs:receivedAt;
      if(this.pendingTiming&&stats&&this.lastUsage!==undefined)this.rate(stats,this.lastUsage);
    }
  }
  private resetTime(){this.firstOutput=undefined;this.lastOutput=undefined;this.pendingTiming=false;this.sawReasoning=false;this.hiddenReasoning=false;this.items.clear();}
  private rate(stats:Generation,output:number){
    const elapsed=(this.lastOutput??0)-(this.firstOutput??0);
    if(!this.hiddenReasoning&&this.firstOutput!==undefined&&elapsed>=100&&output>0)stats.outputTokensPerSecond=output*1000/elapsed;
  }
  update(usage:{total?:{outputTokens?:unknown;totalTokens?:unknown};last?:{outputTokens?:unknown;reasoningOutputTokens?:unknown;totalTokens?:unknown};modelContextWindow?:unknown}|undefined,previous?:Generation){
    const total=usage?.total,last=usage?.last;
    if(!total||!last||!count(total.outputTokens)||!count(last.outputTokens)||last.outputTokens>total.outputTokens)return previous;
    const stats={...previous};
    if(this.baseline===undefined)this.baseline=total.outputTokens-last.outputTokens;
    // Compaction/replayed older snapshots must not inflate turn output or move the displayed total backwards.
    if(this.lastTotal!==undefined&&total.outputTokens<this.lastTotal)return previous;
    stats.outputTokens=total.outputTokens-this.baseline;
    if(count(total.totalTokens))stats.totalTokens=total.totalTokens;
    if(count(last.totalTokens))stats.contextTokens=last.totalTokens;
    if(count(usage?.modelContextWindow)&&usage.modelContextWindow>0)stats.contextWindow=usage.modelContextWindow;
    if(total.outputTokens!==this.lastTotal){
      if(this.pendingTiming)this.resetTime();
      delete stats.outputTokensPerSecond;
      this.hiddenReasoning=count(last.reasoningOutputTokens)&&last.reasoningOutputTokens>0&&!this.sawReasoning;
      this.rate(stats,last.outputTokens);this.lastUsage=last.outputTokens;this.pendingTiming=true;
      this.lastTotal=total.outputTokens;
    }
    return stats;
  }
}
