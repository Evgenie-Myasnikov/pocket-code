import {useRef,useState} from 'react';
import {ChatOverlay} from '../../src/ChatOverlay';
import {ChatHeader} from '../../src/ChatHeader';
import {ChatComposer} from '../../src/ChatComposer';
import {MessageList} from '../../src/Messages';
import {MobileMenuButton} from '../../src/MobileNavigation';
import {useTranscriptFollow,transcriptFollowing} from '../../src/use-transcript-follow';

export function EdgeChatHarness(){
 const [text,setText]=useState(''),[reading,setReading]=useState(false),[extra,setExtra]=useState('');
 const [jump,setJump]=useState(false),[sent,setSent]=useState(0);
 const scroll=useRef<HTMLDivElement>(null),following=useRef(true),last=useRef(0);
 useTranscriptFollow(scroll,following,true,'edge');
 Object.assign(window,{edgeAppend:()=>setExtra(value=>value+'\n\nA new paragraph with implementation details and the next verification step.'),edgeReading:setReading});
 return <div className={`app show-chat chat-edge-to-edge ${reading?'reading-mode':''}`}><main className="workspace chat-canvas">
  <ChatOverlay edge="top"><ChatHeader title="Interface review" project="Example" provider="Claude" onBack={()=>{}} navigation={<MobileMenuButton open={false} onOpen={()=>{}}/>} outputs={{disabled:false,open:()=>{}}} reading={{disabled:false,open:()=>setReading(true)}}/></ChatOverlay>
  <div ref={scroll} className="conversation" style={{overflowAnchor:'none'}} onScroll={event=>{const el=event.currentTarget;following.current=transcriptFollowing(el,last.current,following.current);last.current=el.scrollTop;setJump(!following.current);}}><div className="conversation-inner"><MessageList messages={[
   {id:'first',role:'user',blocks:[{type:'text',text:'How should the interface behave while reading a long conversation?'}]},
   {id:'answer',role:'assistant',blocks:[{type:'text',text:'## A clear reading surface\n\n'+('The conversation continues beneath the controls. You can scroll naturally and keep your place while new information arrives.\n\n').repeat(14)+extra}]},
   {id:'last',role:'assistant',blocks:[{type:'text',text:'The final line stays visible above the input.'}]}
  ]}/></div></div>
  <ChatOverlay edge="bottom">{jump&&<div className="chat-scroll-actions"><button onClick={()=>{following.current=true;scroll.current!.scrollTop=scroll.current!.scrollHeight;}}>Latest message</button></div>}<div className="composer-area"><ChatComposer text={text} label="Synthetic prompt" placeholder="Ask a question" onText={setText} uploading={false} canSend={!!text} attachments={[]} controls={<><select aria-label="Model"><option>Sonnet</option></select><select aria-label="Effort"><option>High</option></select></>} stopLabel="Stop" onRemove={()=>{}} onFiles={()=>{}} onSend={()=>{setSent(value=>value+1);setText('');}}/></div></ChatOverlay>
  <output hidden aria-label="Sent">{sent}</output>
 </main></div>;
}
