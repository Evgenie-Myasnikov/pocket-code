import {useEffect,useRef,useState} from 'react';
import {PanelResizeHandle} from './PanelResizeHandle';
import {useLanguage} from './i18n';
import './board-chat-sheet.css';

export function BoardChatSheetGrip(){
 const ref=useRef<HTMLDivElement>(null),value=useRef(0),extent=useRef(0),[size,setSize]=useState(0),ru=useLanguage()==='ru';
 const limits=()=>({min:Math.min(72,extent.current*.15),max:Math.max(72,extent.current-Math.min(300,extent.current*.7))});
 const apply=(next:number)=>{const {min,max}=limits();value.current=Math.round(Math.max(min,Math.min(max,next)));setSize(value.current);ref.current?.closest<HTMLElement>('.workspace')?.style.setProperty('--board-chat-sheet-top',value.current+'px');};
 const save=(next:number)=>{apply(next);try{localStorage.setItem('pocket-board-chat-sheet-ratio',String(value.current/extent.current));}catch{}};
 useEffect(()=>{const workspace=ref.current!.closest<HTMLElement>('.workspace')!,app=workspace.closest<HTMLElement>('.app')!;const fit=()=>{extent.current=app.getBoundingClientRect().height;let ratio=.18;try{const saved=Number(localStorage.getItem('pocket-board-chat-sheet-ratio'));if(saved>0&&saved<1)ratio=saved;}catch{}apply(extent.current*ratio);};const observer=new ResizeObserver(fit);observer.observe(app);fit();return()=>{observer.disconnect();workspace.style.removeProperty('--board-chat-sheet-top');};},[]);
 return <div ref={ref} className="board-chat-sheet-grip"><PanelResizeHandle axis="y" className="board-chat-sheet-resizer" label={ru?'Размер панели чата':'Chat panel size'} hint={ru?'Перетащите или используйте стрелки. Home — исходный размер.':'Drag or use arrow keys. Home resets the size.'} current={()=>size||value.current} limits={limits} onChange={apply} onCommit={save} onReset={()=>save(extent.current*.18)}/></div>;
}
