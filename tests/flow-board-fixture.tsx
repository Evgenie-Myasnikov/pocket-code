import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {FlowBoard} from '../src/FlowBoard';
import type {Whiteboard as Canvas} from '../src/whiteboard-model';
import '../src/styles.css';
import '../src/tokens.css';
import '../src/neutral-themes.css';
import '../src/work-boards.css';

document.documentElement.dataset.theme='dark';document.documentElement.dataset.palette='carbon';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const query=new URLSearchParams(location.search),stress=query.has('stress');
const long='Synthetic acceptance criteria for a sample card. '.repeat(30);
const sample:Canvas={version:1,items:[
  {id:id(1),kind:'frame',text:'Sample section',x:40,y:40,width:760,height:420,color:'sand'},
  {id:id(2),kind:'card',text:'First sample card',description:long,x:80,y:110,width:280,height:280,color:'sand'},
  {id:id(3),kind:'card',text:'Second sample card',description:'Short description.',x:460,y:110,width:280,height:200,color:'mint'},
  {id:id(4),kind:'sticky',text:'Sample note',x:900,y:120,width:240,height:180,color:'sand'},
  {id:id(5),kind:'text',text:'Sample heading',x:900,y:360,width:240,height:80,color:'sand'},
],links:[{id:id(101),from:id(2),to:id(3),fromSide:'e',toSide:'w',label:'then'},{id:id(102),from:id(3),toPoint:{x:900,y:520},fromSide:'s'}]};
const stressItems=Array.from({length:500},(_,i)=>({id:id(i+1),kind:'card' as const,text:`Card ${i+1}`,description:'Synthetic performance acceptance criteria.\nMove without rebuilding other cards.',x:i%25*320,y:Math.floor(i/25)*260,width:240,height:200,color:'sand' as const}));
const stressBoard:Canvas={version:1,items:stressItems,links:[...stressItems.slice(1).map((item,i)=>({id:id(1000+i),from:stressItems[i].id,to:item.id})),...stressItems.slice(25).map((item,i)=>({id:id(2000+i),from:stressItems[i].id,to:item.id,fromSide:'s' as const,toSide:'n' as const}))]};
function Demo(){
  const [value,setValue]=useState<Canvas>(stress?stressBoard:query.has('empty')?{version:1,items:[],links:[]}:sample);
  (window as any).boardValue=value;
  return <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'var(--bg)'}}>
    <FlowBoard value={value} editable busy={false} renderCard={cardId=>{const w=window as any;w.cardRenders=(w.cardRenders||0)+1;return <span className="board-task-meta"><span className="task-status">Idea</span><span hidden>{cardId}</span></span>;}}
      onSave={async next=>{(window as any).saves=((window as any).saves||0)+1;setValue(next);return true;}}/>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Demo/>);
