import path from 'node:path';
import {HttpError} from './security.js';

type Provider = 'claude' | 'codex' | 'copilot';
type NativeHistory = {eraseOriginal(id:string,cwd:string,outsideRoots?:boolean):Promise<void>};
type ClaudeHistory = {
  getSessionInfo?(id:string,options:{dir:string}):Promise<{sessionId:string;cwd?:string}|undefined>;
  deleteSession?(id:string,options:{dir:string}):Promise<void>;
};

/** The caller reserves and authorizes each ID against a host-owned project and account. */
export function createChatOriginals({sdk,codex,copilot}:{
  sdk:ClaudeHistory;codex?:NativeHistory;copilot?:NativeHistory;
}){
  function canRemove(provider:Provider){
    if(provider==='claude')return typeof sdk.deleteSession==='function'&&typeof sdk.getSessionInfo==='function';
    return typeof (provider==='codex'?codex:copilot)?.eraseOriginal==='function';
  }
  async function remove(provider:Provider,id:string,cwd:string,outsideRoots=false){
    if(!canRemove(provider))throw new HttpError(501,'This provider does not support erasing the original chat on this PC.');
    try {
      if(provider==='claude'&&sdk.getSessionInfo&&sdk.deleteSession){
        const options={dir:cwd};
        const original=await sdk.getSessionInfo(id,options);
        if(original){
          if(original.sessionId!==id||!original.cwd||path.relative(cwd,original.cwd)!=='')
            throw new HttpError(409,'The original chat belongs to a different project.');
          await sdk.deleteSession(id,options);
          if(await sdk.getSessionInfo(id,options))throw new HttpError(409,'The original chat is still present on this PC.');
        }
      } else {
        await (provider==='codex'?codex:copilot)!.eraseOriginal(id,cwd,outsideRoots);
      }
    } catch(error){
      if(error instanceof HttpError)throw error;
      throw new HttpError(502,'The provider could not erase the original chat on this PC. Close it in the provider and retry.');
    }
  }
  return {canRemove,remove};
}
