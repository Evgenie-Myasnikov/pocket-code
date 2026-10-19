import {Capacitor} from '@capacitor/core';
import {desktopCall} from './desktop-bridge';
import {NativeNavigation} from './navigation';

let canvas:CanvasRenderingContext2D|null|undefined;
/** Resolves any CSS colour (hex, rgb, oklch, color-mix) to #rrggbb through a 1×1 canvas, so palettes can use modern colour syntax while native chrome gets plain hex. */
export function cssColor(variable:string,fallback='#111512'){
 const probe=document.createElement('span');probe.hidden=true;probe.style.color=`var(${variable})`;document.documentElement.append(probe);const value=getComputedStyle(probe).color;probe.remove();
 if(canvas===undefined)canvas=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
 if(!canvas||!value)return fallback;
 canvas.clearRect(0,0,1,1);canvas.fillStyle='#000';canvas.fillStyle=value;canvas.fillRect(0,0,1,1);const [r,g,b]=canvas.getImageData(0,0,1,1).data;
 return '#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
}
/** Only computed palette colors cross the native boundary. No arbitrary CSS. Windows gets the DWM caption and border; Android gets status/navigation bar icons and the window background; every platform gets theme-color. */
export function watchWindowTheme(){
 const root=document.documentElement;let last='';
 const update=()=>{const theme={dark:root.dataset.theme!=='light',background:cssColor('--bg'),foreground:cssColor('--text','#e6e8e3'),border:cssColor('--line','#2a302b')};const key=JSON.stringify(theme);if(key===last)return;last=key;
  let meta=document.querySelector<HTMLMetaElement>('meta[name=theme-color]');if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.append(meta);}meta.content=theme.background;
  if(Capacitor.getPlatform()==='android')void NativeNavigation.systemBars({dark:theme.dark,background:theme.background}).catch(()=>{});
  else void desktopCall('window-theme',theme).catch(()=>{});};
 const observer=new MutationObserver(update);observer.observe(root,{attributes:true,attributeFilter:['data-theme','data-palette','data-contrast','style']});update();return()=>observer.disconnect();
}
