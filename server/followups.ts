import {HttpError} from './security.js';
export type FollowupInput={id:string;text:string;displayText?:string;attachmentPaths?:string[]};
/** Keep failed/unknown outcomes too: a retry must never inject the same message twice. */
export class Followups {
  private entries=new Map<string,{signature:string;result:Promise<void>}>();
  run(input:FollowupInput,send:()=>Promise<void>){
    const signature=JSON.stringify(input),existing=this.entries.get(input.id);
    if(existing){if(existing.signature!==signature)throw new HttpError(409,'Message ID already belongs to different input.');return existing.result;}
    if(this.entries.size>=100)throw new HttpError(429,'Too many follow-up messages in this run.');
    const result=Promise.resolve().then(send);this.entries.set(input.id,{signature,result});
    // Local validation failed before delivery; the user can retry once the turn is ready.
    void result.catch(error=>{if(error instanceof HttpError)this.entries.delete(input.id);});
    return result;
  }
}
