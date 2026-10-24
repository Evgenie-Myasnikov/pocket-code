import {useEffect,useRef,useState} from 'react';
import {X,Plus,RefreshCw,Send} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import './custom-providers.css';
type Profile={id:string;name:string;url:string;hasKey:boolean};
type Message={role:'user'|'assistant';content:string};
export function CustomProviders({connection,onClose}:{connection:Connection;onClose():void}){
 const ru=useLanguage()==='ru',l=(en:string,r:string)=>ru?r:en,dialog=useRef<HTMLElement>(null),epoch=useRef(0);
 const [profiles,setProfiles]=useState<Profile[]>([]),[id,setId]=useState(''),[adding,setAdding]=useState(false),[name,setName]=useState(''),[url,setUrl]=useState(''),[key,setKey]=useState(''),[models,setModels]=useState<string[]>([]),[model,setModel]=useState(''),[messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useModal(dialog,true,()=>{if(!busy)onClose();});
 useEffect(()=>{let live=true;request<Profile[]>(connection,'/custom-providers').then(p=>{if(live){setProfiles(p);if(p.length)setId(p[0].id);else setAdding(true);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;epoch.current++;};},[]);
 async function scan(selected=id){if(!selected)return;const turn=++epoch.current;setModels([]);setModel('');setError('');setBusy(true);try{const [catalog,history]=await Promise.all([request<string[]>(connection,`/custom-providers/${selected}/models`),request<Message[]>(connection,`/custom-providers/${selected}/history`)]);if(turn===epoch.current){setModels(catalog);setModel(catalog[0]||'');setMessages(history);if(!catalog.length)setError(l('Provider returned no models','Провайдер вернул пустой каталог моделей'));}}catch(e){if(turn===epoch.current)setError((e as Error).message);}finally{if(turn===epoch.current)setBusy(false);}}
 useEffect(()=>{setMessages([]);void scan(id);},[id]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const saved=await request<{id:string}>(connection,'/custom-providers',{name,url,key});setKey('');setProfiles(await request<Profile[]>(connection,'/custom-providers'));setAdding(false);setId(saved.id);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function send(e:React.FormEvent){e.preventDefault();if(!text.trim()||!model)return;setBusy(true);setError('');try{setMessages(await request<Message[]>(connection,`/custom-providers/${id}/chat`,{model,text}));setText('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="modal-backdrop"><section className="custom-providers-dialog" ref={dialog} role="dialog" aria-modal="true" aria-label={l('Custom providers','Свои провайдеры')}>
  <header><h2>{l('Custom providers','Свои провайдеры')}</h2><button aria-label={l('Close','Закрыть')} disabled={busy} onClick={onClose}><X size={18}/></button></header>
  <div className="custom-provider-select"><select aria-label={l('Provider','Провайдер')} value={id} disabled={busy} onChange={e=>{setAdding(false);setId(e.target.value);}}><option value="" disabled>{l('Choose provider','Выбери провайдера')}</option>{profiles.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select><button disabled={busy} onClick={()=>setAdding(!adding)}><Plus size={18}/>{l('Add','Добавить')}</button></div>
  {adding?<form onSubmit={save} className="custom-provider-form"><label>{l('Name','Название')}<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><label>{l('API base URL','Базовый URL API')}<input required type="url" placeholder="https://api.example.com/v1" value={url} onChange={e=>setUrl(e.target.value)}/></label><label>{l('API key','Ключ API')}<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)}/></label><p>{l('OpenAI-compatible API. The key is encrypted on your PC. Models are loaded from /models.','OpenAI-совместимый API. Ключ хранится зашифрованным на ПК. Модели загружаются через /models.')}</p><button disabled={busy} type="submit">{l('Save and load models','Сохранить и загрузить модели')}</button></form>:<>
   <div className="custom-provider-select"><select aria-label={l('Model','Модель')} value={model} disabled={busy||!models.length} onChange={e=>setModel(e.target.value)}><option value="" disabled>{busy?l('Loading…','Загрузка…'):l('No models','Нет моделей')}</option>{models.map(m=><option key={m}>{m}</option>)}</select><button aria-label={l('Refresh models','Обновить модели')} disabled={busy||!id} onClick={()=>void scan()}><RefreshCw size={17}/></button></div>
   <small>{l('API chat · no project file tools. Recent messages stay on your PC.','API-чат · без инструментов файлов проекта. Последние сообщения сохраняются на ПК.')}</small>
   <div className="custom-provider-messages" role="log">{messages.map((m,i)=><article key={i} className={m.role}><strong>{m.role==='user'?l('You','Ты'):profiles.find(p=>p.id===id)?.name}</strong><p>{m.content}</p></article>)}</div>
   <form className="custom-provider-compose" onSubmit={send}><textarea aria-label={l('Message','Сообщение')} value={text} maxLength={16000} onChange={e=>setText(e.target.value)} disabled={busy}/><button aria-label={l('Send','Отправить')} disabled={busy||!model||!text.trim()}><Send size={18}/></button></form>
  </>}
  {busy&&<p role="status">{l('Connecting…','Запрос…')}</p>}{error&&<p role="alert">{error}</p>}
 </section></div>;
}
