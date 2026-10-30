import {useBackground} from './background-settings';
import {useEffect,useState} from 'react';
import './chat-atmosphere.css';
import {BackgroundEffect} from './BackgroundEffect';
import {backgroundPreview} from './background-styles';
export function ChatAtmosphere({active,empty}:{active:boolean;empty:boolean}){
 const background=useBackground();
 const [allowed,setAllowed]=useState(false),[theme,setTheme]=useState({color:'',light:false});
 useEffect(()=>{const reduced=matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)');const update=()=>{setAllowed(!reduced.matches&&!document.hidden);setTheme({color:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),light:document.documentElement.dataset.theme==='light'});};const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-palette','style']});reduced.addEventListener('change',update);document.addEventListener('visibilitychange',update);update();return()=>{observer.disconnect();reduced.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);};},[]);
 if(!background.enabled)return null;
 return <div className="chat-atmosphere" data-empty={empty} data-style={background.style} data-moving={active&&allowed&&background.speed>0} style={{opacity:background.intensity/100,backgroundImage:`url("${backgroundPreview(background.style)}")`,backgroundSize:'cover',backgroundPosition:'center'}} aria-hidden="true">{active&&<BackgroundEffect kind={background.style} color={background.color} speed={background.speed} paused={!allowed||background.speed===0} light={theme.light}/>}</div>;
}
