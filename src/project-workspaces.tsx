import {useEffect,useRef,useState} from 'react';
import {startVisiblePoll} from './visible-poll';
import {request,type Connection} from './api';
import type {ProjectWorkspace,ProjectBoard} from '../server/boards';
export type WorkspaceCatalog={host:boolean;activeWorkspaceId?:string;canManageWorkspaces?:boolean;workspaces:ProjectWorkspace[];boards:(Pick<ProjectBoard,'id'|'workspaceId'|'name'|'root'>&{noteCount:number})[]};
const empty:WorkspaceCatalog={host:false,workspaces:[],boards:[]};
const event='pocket-project-workspace';
export function useProjectWorkspaces(connection:Connection|null){
  const key='pocket-project-workspace:'+ (connection?.url||'');
  const [catalog,setCatalog]=useState<WorkspaceCatalog>(empty),[selected,setSelected]=useState(''),[error,setError]=useState('');
  const generation=useRef(0);const [offline,setOffline]=useState(false);
  useEffect(()=>{const stale=()=>setOffline(true),fresh=()=>setOffline(false);window.addEventListener('pocket-offline-read',stale);window.addEventListener('pocket-online-read',fresh);return()=>{window.removeEventListener('pocket-offline-read',stale);window.removeEventListener('pocket-online-read',fresh);};},[]);
  const refresh=async()=>{if(!connection)return;const epoch=++generation.current;try{const data=await request<WorkspaceCatalog>(connection,'/workspaces'+(connection.workspaceId?'?workspaceId='+encodeURIComponent(connection.workspaceId):''));if(!Array.isArray(data.workspaces))throw Error('Workspaces are unavailable. Update the PC host.');if(epoch===generation.current){setCatalog(data);setSelected(connection.workspaceId||(connection.desktop&&localStorage.getItem(key))||data.activeWorkspaceId||'');setError('');}}catch(e){if(epoch===generation.current)setError((e as Error).message);}};
  useEffect(()=>{setCatalog(empty);try{setSelected(connection?.workspaceId||localStorage.getItem(key)||'');}catch{};const stop=startVisiblePoll(refresh,10000);const receive=(e:Event)=>{if((e as CustomEvent).detail?.key===key){setSelected((e as CustomEvent).detail.id);void refresh();}};window.addEventListener(event,receive);return()=>{generation.current++;stop();window.removeEventListener(event,receive);};},[connection?.url,connection?.token]);
  const select=(id:string)=>{setSelected(id);try{localStorage.setItem(key,id);}catch{}window.dispatchEvent(new CustomEvent(event,{detail:{key,id}}));};
  const workspace=catalog.workspaces.find(w=>w.id===selected);
  return {catalog,workspace,selected,select,refresh,error,offline};
}
export function inWorkspace(root:string|undefined,workspace?:ProjectWorkspace){return !workspace||!!root&&workspace.roots.some(folder=>(()=>{const value=root.replace(/\\/g,'/').replace(/\/$/,'').toLowerCase(),base=folder.replace(/\\/g,'/').replace(/\/$/,'').toLowerCase();return value===base||value.startsWith(base+'/');})());}
