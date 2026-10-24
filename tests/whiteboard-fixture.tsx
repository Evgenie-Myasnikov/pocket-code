import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Whiteboard} from '../src/Whiteboard';
import {ProviderPicker} from '../src/ProviderPicker';
import type {Whiteboard as Canvas} from '../src/whiteboard-model';
import '../src/styles.css';
import '../src/tokens.css';
import '../src/work-boards.css';
function Demo(){const [value,setValue]=useState<Canvas>(),[provider,setProvider]=useState<'claude'|'codex'|'copilot'>('codex');return <div style={{height:'100vh',display:'flex',flexDirection:'column'}}><ProviderPicker value={provider} onChange={setProvider}/><Whiteboard value={value} editable busy={false} onSave={async v=>{setValue(v);return true;}}/></div>;}
createRoot(document.getElementById('root')!).render(<Demo/>);
