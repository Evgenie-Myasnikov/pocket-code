import {useEffect,useState} from 'react';
import {ChatComposer} from '../../src/ChatComposer';
import {Markdown} from '../../src/RichBlocks';
import {ModelPicker} from '../../src/ModelPicker';
export function ComposerHarness(){
 const [draft,setDraft]=useState(''),[stream,setStream]=useState('Saved text. '),[model,setModel]=useState('sonnet'),[sent,setSent]=useState(0),[stopped,setStopped]=useState(false);
 useEffect(()=>{(window as any).setSyntheticStream=setStream;return()=>{delete (window as any).setSyntheticStream;};},[]);
 return <main style={{maxWidth:850,margin:'auto',padding:'24px 10px',color:'var(--text)'}}>
  <h2>Conversation</h2><div className="message assistant" id="synthetic-stream"><Markdown text={stream} streaming/></div>
  <ChatComposer text={draft} onText={setDraft} label="Synthetic prompt" placeholder="What would you like to create?" uploading={false} canSend={!!draft.trim()} attachments={[]}
    controls={<><ModelPicker provider="claude" name="Claude" models={[{id:'sonnet',name:'Sonnet · current version',isDefault:true},{id:'opus',name:'Opus'}]} value={model} onChange={setModel}/><select className="effort-picker" aria-label="Effort"><option>High</option><option>Medium</option></select></>}
    onRemove={()=>{}} onFiles={()=>{}} onSend={()=>{setSent(count=>count+1);setDraft('');}} stopLabel="Stop synthetic" onStop={stopped?undefined:()=>setStopped(true)}/>
  <output aria-label="Sent">{sent}</output>
 </main>;
}
