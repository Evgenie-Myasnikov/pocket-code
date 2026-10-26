import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ChatHeader} from '../src/ChatHeader';
import {CardActionMenu} from '../src/CardActionMenu';
import {ProviderPicker} from '../src/ProviderPicker';
import {AccessModeChip,type AccessMode} from '../src/AccessModeChip';
import '../src/work-boards.css';

function MenuFixture({element}:{element:HTMLElement}){
 const [card,setCard]=useState(false),[provider,setProvider]=useState<'claude'|'codex'|'copilot'>('claude'),[mode,setMode]=useState<AccessMode>('default');
 return <>
  <ChatHeader title="Synthetic chat" project="Atlas" provider="Claude" onBack={()=>{}} detail={{value:'brief',set:()=>{}}} review={{disabled:false,open:()=>{element.dataset.review='opened';}}}/>
  <button onClick={()=>setCard(true)}>Card actions</button>
  <ProviderPicker value={provider} onChange={setProvider}/>
  <AccessModeChip provider="claude" value={mode} onChange={setMode}/>
  {card&&<CardActionMenu label="Synthetic card menu" point={{x:30,y:160}} onClose={()=>setCard(false)} items={[
   {label:'Current action',current:true,onSelect:()=>{}},
   {label:'Unavailable action',disabled:true,onSelect:()=>{}},
   {label:'Remove example',danger:true,onSelect:()=>{}},
  ]}/>}
 </>;
}
export function mountMenus(){const element=document.createElement('main');element.style.cssText='padding:20px;max-width:700px';document.body.replaceChildren(element);createRoot(element).render(<MenuFixture element={element}/>);}
