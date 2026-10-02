import {desktopCall} from './desktop-bridge';
/** Only computed palette colors cross the native boundary. No arbitrary CSS. */
export function watchWindowTheme(){
 const root=document.documentElement,probe=document.createElement('span');probe.hidden=true;root.append(probe);let last='';
 const color=(variable:string)=>{probe.style.color=`var(${variable})`;const channels=getComputedStyle(probe).color.match(/\d+/g)?.slice(0,3);return channels?.length===3?'#'+channels.map(n=>Number(n).toString(16).padStart(2,'0')).join(''):'#111512';};
 const update=()=>{const theme={dark:root.dataset.theme!=='light',background:color('--bg'),foreground:color('--text'),border:color('--line')};const key=JSON.stringify(theme);if(key===last)return;last=key;void desktopCall('window-theme',theme).catch(()=>{});};
 const observer=new MutationObserver(update);observer.observe(root,{attributes:true,attributeFilter:['data-theme','style']});update();return()=>{observer.disconnect();probe.remove();};
}
