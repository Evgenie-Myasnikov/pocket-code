import {scrollChatToLatest} from '../../src/chat-scroll-motion';
import {useRef,useState} from 'react';
import {MessageList,PartialMessage} from '../../src/Messages';
import {useTranscriptFollow,transcriptFollowing} from '../../src/use-transcript-follow';
import type {ChatMessage} from '../../server/types';
const message=(id:string,text:string):ChatMessage=>({id,role:'assistant',blocks:[{type:'text',text}]});
export function TranscriptFollowHarness(){
 const [messages,setMessages]=useState([message('old','Already received response. '.repeat(30))]);
 const [visible,setVisible]=useState(true),[running,setRunning]=useState(true);
 const scroll=useRef<HTMLDivElement>(null),following=useRef(true),lastTop=useRef(0);
 useTranscriptFollow(scroll,following,visible,'synthetic');
 Object.assign(window,{resumeFollowing:()=>{following.current=true;if(scroll.current)scrollChatToLatest(scroll.current);},appendAnswer:()=>setMessages(old=>[...old,message('new','New flowing answer with multiple lines. '.repeat(12))]),finishAnswer:()=>setRunning(false),toggleTranscript:()=>setVisible(v=>!v),addImageSpace:()=>{const el=document.getElementById('late-image');if(el)el.style.height='400px';}});
 return visible?<div ref={scroll} className="conversation" style={{height:240,flex:'none',width:320,overflow:'auto',overflowAnchor:'none'}} onScroll={e=>{const el=e.currentTarget;following.current=transcriptFollowing(el,lastTop.current,following.current);lastTop.current=el.scrollTop;}}><div className="conversation-inner" style={{padding:0}}><MessageList messages={messages} streaming={running}/><div id="late-image"/></div></div>:<p>Closed</p>;
}

export function PartialSnapshotHarness(){
 const [text,setText]=useState(''),[visible,setVisible]=useState(true);
 Object.assign(window,{setPartial:setText,togglePartial:()=>setVisible(v=>!v)});
 return visible?<PartialMessage text={text} streaming/>:null;
}
