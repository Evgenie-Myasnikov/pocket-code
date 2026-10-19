import {useSyncExternalStore} from 'react';
import type {CodexUsageSnapshot} from '../server/codex-usage';

/** Values the settings index shows as live summaries. They come from reads that already run (usage ring, limits page, update checks); nothing here polls. */
type Provider='claude'|'codex'|'copilot';
const usage=new Map<Provider,CodexUsageSnapshot>();
let update:string|null=null,version=0;
const listeners=new Set<()=>void>();
const emit=()=>{version++;listeners.forEach(listener=>listener());};
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export function publishUsage(provider:Provider,snapshot:CodexUsageSnapshot|null){if(snapshot)usage.set(provider,snapshot);else usage.delete(provider);emit();}
export function publishUpdate(next:string|null){if(next===update)return;update=next;emit();}
export function useLiveSettings(){useSyncExternalStore(subscribe,()=>version,()=>0);return {usage:(provider:Provider)=>usage.get(provider)||null,update};}
export const availableUpdate=()=>update;
