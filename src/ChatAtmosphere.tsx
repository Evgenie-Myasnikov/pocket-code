import {lazy,Suspense,useEffect,useState} from 'react';
import './chat-atmosphere.css';
const DarkVeil=lazy(()=>import('./vendor/react-bits/DarkVeil'));
export function ChatAtmosphere({active,empty}:{active:boolean;empty:boolean}){
 const [allowed,setAllowed]=useState(false),[theme,setTheme]=useState({color:'',light:false});
 useEffect(()=>{const reduced=matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)');const update=()=>{setAllowed(!reduced.matches&&!document.hidden);setTheme({color:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),light:document.documentElement.dataset.theme==='light'});};const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-palette','style']});reduced.addEventListener('change',update);document.addEventListener('visibilitychange',update);update();return()=>{observer.disconnect();reduced.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);};},[]);
 return <div className="chat-atmosphere" data-empty={empty} aria-hidden="true">{active&&allowed&&theme.color&&<Suspense fallback={null}><DarkVeil color={theme.color} speed={.2} quality={.25} dpr={1} lightMode={theme.light} paused={!empty} mouseInteraction={false} intro={false} grain={0} brightness={.7}/></Suspense>}</div>;
}
