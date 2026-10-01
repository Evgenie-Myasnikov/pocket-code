import {useEffect,useState} from 'react';
import {t} from './i18n';
import './effort-picker.css';

export type EffortModel={id:string;name:string;reasoningEfforts?:string[];defaultReasoningEffort?:string;isDefault?:boolean};
type Choices=Record<string,string>;
const storageKey='pocket-code-codex-effort-v1';
function load():Choices{
  try{
    const saved:unknown=JSON.parse(localStorage.getItem(storageKey)||'{}');
    if(!saved||typeof saved!=='object'||Array.isArray(saved))return{};
    return Object.fromEntries(Object.entries(saved).filter(([key,value])=>key.length<=200&&typeof value==='string'&&value.length<=40));
  }catch{return{};}
}
function persist(value:Choices){try{localStorage.setItem(storageKey,JSON.stringify(value));}catch{/* Keep this choice for the current session. */}}

/** Resolve against the current advertised model before exposing an effort to send(). */
export function useCodexEffort(models:EffortModel[]|undefined,model:string){
  const [choices,setChoices]=useState<Choices>(load);
  const effective=model?models?.find(item=>item.id===model):models?.find(item=>item.isDefault)||(models?.length===1?models[0]:undefined);
  const options=[...new Set((effective?.reasoningEfforts||[]).filter(value=>typeof value==='string'&&value.length>0&&value.length<=40))];
  const id=effective?.id||'',stored=Object.hasOwn(choices,id)?choices[id]:'';
  const value=options.includes(stored)?stored:'';
  const signature=JSON.stringify(options);
  useEffect(()=>{
    if(!id||!stored||value)return;
    setChoices(previous=>{const next={...previous};delete next[id];persist(next);return next;});
  },[id,stored,value,signature]);
  const onChange=(nextValue:string)=>{
    if(!id||nextValue&&!options.includes(nextValue))return;
    setChoices(previous=>{
      const next={...previous};
      if(nextValue)Object.defineProperty(next,id,{value:nextValue,enumerable:true,writable:true,configurable:true});else delete next[id];
      persist(next);return next;
    });
  };
  const defaultValue=effective?.defaultReasoningEffort&&options.includes(effective.defaultReasoningEffort)?effective.defaultReasoningEffort:undefined;
  return{value,options,defaultValue,modelId:id,onChange};
}

function label(value:string){
  const names:Record<string,string>={none:'Без рассуждений',minimal:'Минимальная',low:'Низкая',medium:'Средняя',high:'Высокая',xhigh:'Очень высокая',max:'Максимальная',ultra:'Ультра'};
  return Object.hasOwn(names,value)?t(names[value]):value;
}
export function EffortPicker({value,options,defaultValue,onChange,disabled=false}:ReturnType<typeof useCodexEffort>&{disabled?:boolean}){
  if(!options.length)return null;
  return <select className="effort-picker" aria-label={t('Глубина рассуждений Codex')} title={defaultValue?t('По умолчанию: {0}',label(defaultValue)):t('Глубина рассуждений Codex')} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)}>
    <option value="">{defaultValue?t('По умолчанию ({0})',label(defaultValue)):t('По умолчанию')}</option>
    {options.map(option=><option key={option} value={option}>{label(option)}</option>)}
  </select>;
}
