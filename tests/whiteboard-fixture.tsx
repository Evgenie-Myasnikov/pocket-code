import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Whiteboard} from '../src/Whiteboard';
import {ProviderPicker} from '../src/ProviderPicker';
import type {Whiteboard as Canvas} from '../src/whiteboard-model';
import '../src/styles.css';
import '../src/tokens.css';
import '../src/work-boards.css';
const ports=new URLSearchParams(location.search).has('ports');
const initial:Canvas={version:1,items:[{id:'11111111-1111-4111-8111-111111111111',kind:'sticky',text:'One',x:120,y:100,width:240,height:180,color:'sand'},{id:'22222222-2222-4222-8222-222222222222',kind:'sticky',text:'Two',x:620,y:320,width:240,height:180,color:'sand'}],links:[]};
function Demo(){const [value,setValue]=useState<Canvas|undefined>(()=>ports?JSON.parse(sessionStorage.getItem('port-fixture')||JSON.stringify(initial)):undefined),[provider,setProvider]=useState<'claude'|'codex'|'copilot'>('codex');return <div style={{height:'100vh',display:'flex',flexDirection:'column'}}><ProviderPicker value={provider} onChange={setProvider}/><Whiteboard value={value} editable busy={false} onSave={async v=>{setValue(v);if(ports)sessionStorage.setItem('port-fixture',JSON.stringify(v));return true;}}/></div>;}
createRoot(document.getElementById('root')!).render(<Demo/>);
