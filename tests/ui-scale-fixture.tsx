import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useAppearance} from '../src/Appearance';
import {ProviderPicker} from '../src/ProviderPicker';
import {Whiteboard} from '../src/Whiteboard';
import type {Whiteboard as Canvas} from '../src/whiteboard-model';
import '../src/tokens.css';
import '../src/styles.css';
import '../src/work-boards.css';
import '../src/compact-ui.css';
function Demo(){const {appearance,setAppearance}=useAppearance(),[provider,setProvider]=useState<'claude'|'codex'|'copilot'>('codex'),[canvas,setCanvas]=useState<Canvas>({version:1,items:[{id:'11111111-1111-4111-8111-111111111111',kind:'sticky',text:'Canvas geometry',x:50,y:50,width:240,height:180,color:'sand'}],links:[]});return <>
 <label>Scale<input aria-label="Scale" type="range" min="60" max="130" value={appearance.scale} onChange={e=>setAppearance({...appearance,scale:Number(e.target.value)})}/></label>
 <div className="work-boards"><div className="board-header-navigation"><div className="board-title"><h2>Example board</h2></div></div></div>
 <ProviderPicker value={provider} onChange={setProvider}/>
 <Whiteboard value={canvas} editable busy={false} onSave={async value=>{setCanvas(value);return true;}}/>
 <div className="board-dialog"><h2>Properties</h2><label>Value<input defaultValue="Example"/></label></div>
 </>;}
createRoot(document.getElementById('root')!).render(<Demo/>);
