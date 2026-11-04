import {backgroundStyles,backgroundStyle,backgroundPreview} from './background-styles';
import './background-styles.css';
import {useEffect,useState,useSyncExternalStore,type CSSProperties} from 'react';
import {useLanguage} from './i18n';
import {ChatAtmosphere} from './ChatAtmosphere';
import {Check,RotateCcw} from 'lucide-react';
const key='pocket-code-background-v1',event='pocket-background-changed';
export const backgroundDefaults={enabled:typeof location!=='undefined'&&new URLSearchParams(location.search).get('desktop')==='1',chat:true,controls:true,sidebar:true,style:backgroundStyle('veil'),color:'',intensity:38,speed:20};
export function normalizeBackground(value:unknown){const v=(value&&typeof value==='object'?value:{}) as Record<string,unknown>;const number=(x:unknown,f:number)=>typeof x==='number'&&Number.isFinite(x)?Math.max(0,Math.min(100,x)):f;return {style:backgroundStyle(v.style),enabled:typeof v.enabled==='boolean'?v.enabled:backgroundDefaults.enabled,chat:typeof v.chat==='boolean'?v.chat:true,controls:typeof v.controls==='boolean'?v.controls:true,sidebar:typeof v.sidebar==='boolean'?v.sidebar:true,color:typeof v.color==='string'&&/^#[\da-f]{6}$/i.test(v.color)?v.color:'',intensity:number(v.intensity,38),speed:number(v.speed,20)};}
function read(){try{return localStorage.getItem(key)||'';}catch{return '';}}
function subscribe(fn:()=>void){window.addEventListener(event,fn);window.addEventListener('storage',fn);return()=>{window.removeEventListener(event,fn);window.removeEventListener('storage',fn);};}
export function useBackground(){const raw=useSyncExternalStore(subscribe,read,()=> '');try{return normalizeBackground(JSON.parse(raw||'{}'));}catch{return backgroundDefaults;}}
export function BackgroundSurfacePreferences(){
 const {chat,controls,sidebar}=useBackground();
 useEffect(()=>{const root=document.documentElement;root.dataset.backgroundChat=String(chat);root.dataset.backgroundControls=String(controls);root.dataset.backgroundSidebar=String(sidebar);},[chat,controls,sidebar]);
 return null;
}
function BackgroundRegions({value,onChange}:{value:ReturnType<typeof normalizeBackground>;onChange(patch:Partial<ReturnType<typeof normalizeBackground>>):void}){
 const ru=useLanguage()==='ru';
 const regions=[['chat',ru?'Фон за перепиской':'Conversation backdrop'],['controls',ru?'Фон за прозрачными кнопками и полем ввода':'Background behind transparent controls'],['sidebar',ru?'Фон за панелью чатов':'Chat sidebar background']] as const;
 return <div className="background-regions" role="group" aria-label={ru?'Где показывать фон':'Background areas'}>{regions.map(([key,label])=><label key={key}><input type="checkbox" checked={value[key]} onChange={event=>onChange({[key]:event.target.checked})}/>{label}</label>)}</div>;
}
export function BackgroundSettings(){
 const language=useLanguage(),v=useBackground(),label=(ru:string,en:string)=>language==='ru'?ru:en;
 const [error,setError]=useState(false);
 const save=(patch:Partial<typeof v>)=>{try{localStorage.setItem(key,JSON.stringify({...v,...patch}));window.dispatchEvent(new Event(event));setError(false);}catch{setError(true);}};
 const selected=backgroundStyles.find(style=>style.id===v.style)!;
 return <fieldset className="background-settings">
  <legend>{label('Фон чата','Chat background')}</legend>
  <label className="background-enabled"><input type="checkbox" checked={v.enabled} onChange={e=>save({enabled:e.target.checked})}/>{label('Показывать фон','Show background')}</label>
  <div className="background-preview"><ChatAtmosphere active empty preview/><div className="background-preview-caption"><span>{label('Предпросмотр фона','Background preview')}</span><strong>{label(selected.ru,selected.en)}</strong></div></div>
  <div className="background-style-options" role="group" style={{'--background-tint':v.color||'var(--accent)'} as CSSProperties} aria-label={label('Вид фона','Background style')}>
   {backgroundStyles.map(style=><button type="button" key={style.id} aria-pressed={v.style===style.id} onClick={()=>save({style:style.id})}><span className="background-swatch" style={{backgroundImage:`url("${backgroundPreview(style.id)}")`}} aria-hidden="true"/><span className="background-style-title">{label(style.ru,style.en)}<Check size={14} aria-hidden="true"/></span></button>)}
  </div>
  <div className="background-adjustments">
   <div className="background-color-control"><label>{label('Цвет фона','Background color')}<input type="color" value={v.color||'#1fd8a4'} onChange={e=>save({color:e.target.value})}/></label><button type="button" className="text-button" aria-pressed={!v.color} onClick={()=>save({color:''})}>{label('Использовать цвет темы','Use theme color')}</button></div>
   {(['intensity','speed'] as const).map(name=><label className="background-slider" key={name}>{name==='speed'?label('Скорость движения','Motion speed'):label('Интенсивность','Intensity')}<span aria-hidden="true">{v[name]}%</span><input type="range" min="0" max="100" value={v[name]} onChange={e=>save({[name]:Number(e.target.value)})}/></label>)}
  </div>
  <div className="background-area-settings"><h3>{label('Где показывать фон','Background areas')}</h3><BackgroundRegions value={v} onChange={save}/></div>
  <button type="button" className="text-button background-reset" onClick={()=>save(backgroundDefaults)}><RotateCcw size={16} aria-hidden="true"/>{label('Сбросить фон','Reset background')}</button>
  {error&&<p role="alert">{label('Не удалось сохранить настройки','Could not save settings')}</p>}
 </fieldset>;
}
