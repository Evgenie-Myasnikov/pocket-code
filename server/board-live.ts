import {randomUUID} from 'node:crypto';
export type BoardEditActivity={id:string;ids:string[];phase:'editing'|'saved'|'failed';expiresAt:number};
/** Ephemeral MCP activity contains object IDs only, never account or conversation data. */
export class BoardLiveActivity{
 private entries=new Map<string,BoardEditActivity>();
 set(key:string,ids:string[],phase:BoardEditActivity['phase']){const value={id:randomUUID(),ids:[...new Set(ids)],phase,expiresAt:Date.now()+8000};this.entries.delete(key);this.entries.set(key,value);while(this.entries.size>128)this.entries.delete(this.entries.keys().next().value!);return value;}
 get(key:string){const value=this.entries.get(key);if(value&&value.expiresAt>Date.now())return value;this.entries.delete(key);return null;}
}
