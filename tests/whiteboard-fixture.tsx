import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Whiteboard} from '../src/Whiteboard';
import {ProviderPicker} from '../src/ProviderPicker';
import type {Whiteboard as Canvas} from '../src/whiteboard-model';
import '../src/styles.css';
import '../src/tokens.css';
import '../src/work-boards.css';
const ports=new URLSearchParams(location.search).has('ports'),stress=new URLSearchParams(location.search).has('stress');
const stressItems=Array.from({length:400},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,kind:'card' as const,text:`Card ${i+1}`,description:'Synthetic performance acceptance criteria.\nMove without rebuilding other cards.',x:i%20*320,y:Math.floor(i/20)*240,width:240,height:180,color:'sand' as const}));
const stressBoard:Canvas={version:1,items:stressItems,links:stressItems.slice(1).map((item,i)=>({id:`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,from:stressItems[i].id,to:item.id,fromSide:'e',toSide:'w'}))};
const initial:Canvas={version:1,items:[{id:'11111111-1111-4111-8111-111111111111',kind:'sticky',text:'One',x:120,y:100,width:240,height:180,color:'sand'},{id:'22222222-2222-4222-8222-222222222222',kind:'sticky',text:'Two',x:620,y:320,width:240,height:180,color:'sand'}],links:[]};
if(new URLSearchParams(location.search).has('linked'))initial.links=[{id:'33333333-3333-4333-8333-333333333333',from:initial.items[0].id,to:initial.items[1].id,fromSide:'e',toSide:'w'}];
function Demo(){const [value,setValue]=useState<Canvas|undefined>(()=>stress?stressBoard:ports?JSON.parse(sessionStorage.getItem('port-fixture')||JSON.stringify(initial)):undefined),[provider,setProvider]=useState<'claude'|'codex'|'copilot'>('codex');return <div style={{height:'100vh',display:'flex',flexDirection:'column'}}><ProviderPicker value={provider} onChange={setProvider}/><React.Profiler id="canvas" onRender={(_,phase,duration)=>{const w=window as any;(w.canvasCommits??=[]).push({phase,duration});}}><Whiteboard renderCard={stress?id=>{const w=window as any;w.cardRenders=(w.cardRenders||0)+1;return <span>Card metadata</span>;}:undefined} value={value} editable busy={false} onSave={async v=>{setValue(v);if(ports)sessionStorage.setItem('port-fixture',JSON.stringify(v));return true;}}/></React.Profiler></div>;}
createRoot(document.getElementById('root')!).render(<Demo/>);
