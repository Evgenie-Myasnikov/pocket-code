import {useState} from 'react';
import {Markdown} from '../../src/RichBlocks';
import {RunningAction} from '../../src/RunningAction';
export function LivePresentationHarness(){
 const [stream,setStream]=useState(true);(window as any).finish=()=>setStream(false);
 return <><div id="answer"><Markdown text="A synthetic streamed response that must finish smoothly." streaming={stream} animateInitial/></div><RunningAction job={{id:'sample',cwd:'',status:'running',startedAt:0,revision:0,baseMessageCount:0,messages:[{id:'1',role:'assistant',blocks:[{type:'tool_use',name:'Bash',input:{command:'npm run build'}}]}],partial:'',approvals:[]}}/></>;
}
