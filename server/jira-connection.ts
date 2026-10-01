import {readFile,writeFile} from 'node:fs/promises';
import type {JiraService} from './jira.js';
export type JiraSource='claude'|'codex';
/** One selected Jira connection; the AI that executes tasks is independent. */
export class JiraConnection {
  private source:JiraSource='claude';
  readonly ready:Promise<void>;
  readonly service:JiraService;
  constructor(private file:string,private services:Record<JiraSource,JiraService>){
    this.ready=readFile(file,'utf8').then(text=>{const value=JSON.parse(text);if(value.source==='codex')this.source='codex';}).catch((error)=>{if(error.code!=='ENOENT')throw error;});
    this.service=new Proxy({} as JiraService,{get:(_target,key)=>async(...args:unknown[])=>{await this.ready;const service=this.services[this.source];const method=(service as any)[key];if(typeof method!=='function')throw Error('This Jira connection does not support the requested operation.');return method.apply(service,args);}});
  }
  async status(){await this.ready;return {source:this.source,...await this.services[this.source].status()};}
  selected(){return this.source;}
  async select(source:JiraSource){await this.ready;await writeFile(this.file,JSON.stringify({source}),{mode:0o600});this.source=source;return this.status();}
  async verify(source:JiraSource){const service=this.services[source];return service.useExisting?service.useExisting():service.status();}
}
