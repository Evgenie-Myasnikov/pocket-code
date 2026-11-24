import {useEffect,useRef,useState} from 'react';
import {Cpu,Loader2,Play,Square,RefreshCw,CheckCircle2} from 'lucide-react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {Notice} from './Notice';
import {customProvidersChanged} from './custom-account';
import './provider-connections.css';

type Job={state:'stopped'|'starting'|'ready'|'stopping'|'error';model?:string;url?:string;port?:number;error?:string;since?:number};
export type LocalModelStatus={available:false;models:[];running:[];busy:false;job:Job}|{available:true;version:string;port:number;models:{id:string;name:string;context?:number;ready:boolean}[];running:{name:string;state:string;port:number}[];busy:boolean;job:Job};
const contexts=[32768,65536,131072,262144] as const;
const draftings=['auto','dflash2','mtp','off'] as const;
const CHOICE='pocket.localModel.choice';
type Choice={model:string;context:number;drafting:typeof draftings[number]};
function readChoice():Partial<Choice>{try{return JSON.parse(localStorage.getItem(CHOICE)||'{}')||{};}catch{return {};}}
function writeChoice(choice:Choice){try{localStorage.setItem(CHOICE,JSON.stringify(choice));}catch{}}
const draftLabel=(d:string)=>d==='auto'?t('Авто (рекомендуется)'):d==='off'?t('Выключен'):d==='mtp'?'MTP':'DFlash2';

/** Starts and stops a local Strata model on this PC without the Strata window; the running server becomes a custom provider. */
export function LocalModelSettings({connection,online=true}:{connection:Connection|null;online?:boolean}){
  useLanguage();
  const [status,setStatus]=useState<LocalModelStatus|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  const saved=useRef(readChoice()),[model,setModel]=useState(saved.current.model||''),[context,setContext]=useState<number>(saved.current.context||131072),[drafting,setDrafting]=useState<Choice['drafting']>(saved.current.drafting||'auto');
  const lastState=useRef<Job['state']|''>('');
  useEffect(()=>{if(!connection||!online){setStatus(null);return;}let live=true,timer:ReturnType<typeof setTimeout>|undefined;
    const load=()=>request<LocalModelStatus>(connection,'/local-models').then(next=>{if(!live)return;setStatus(next);setError('');
      if(next.job.state==='ready'&&lastState.current&&lastState.current!=='ready')customProvidersChanged();lastState.current=next.job.state;
      if(next.job.state==='starting'||next.job.state==='stopping')timer=setTimeout(load,3000);}).catch(e=>{if(live)setError((e as Error).message);});
    void load();return()=>{live=false;if(timer)clearTimeout(timer);};},[connection,online,revision]);
  useEffect(()=>{if(status?.available&&status.models.length&&!status.models.some(m=>m.id===model))setModel(status.models[0].id);},[status]);
  if(!connection||!online)return null;
  if(!status)return error?<Notice tone="error">{error}</Notice>:<p role="status" className="muted">{t('Проверяем локальные модели…')}</p>;
  if(!status.available)return <p className="muted settings-note">{t('Strata не найдена на этом ПК. Установите её, чтобы запускать локальные модели отсюда.')}</p>;
  const job=status.job,running=job.state==='ready'||status.running.length>0,working=busy||job.state==='starting'||job.state==='stopping';
  async function act(path:'/local-models/start'|'/local-models/stop',body:unknown){setBusy(true);setError('');try{await request(connection!,path,body);}catch(e){setError((e as Error).message);}finally{setBusy(false);setRevision(v=>v+1);}}
  function start(){const choice={model,context,drafting};writeChoice(choice);void act('/local-models/start',choice);}
  const stateText=job.state==='starting'?t('Запускается… Загрузка модели может занять несколько минут.'):job.state==='stopping'?t('Останавливается…'):job.state==='ready'?t('Работает'):job.state==='error'?t('Ошибка запуска'):status.running.length?t('Запущена вне Pocket Code'):t('Остановлена');
  return <section className="provider-connections provider-connections-single" aria-labelledby="local-model-title"><article className="provider-card">
    <header><h3 id="local-model-title"><Cpu size={18} aria-hidden="true"/> {t('Локальная модель (Strata)')}</h3><button className="icon-button" aria-label={t('Обновить состояние')} title={t('Обновить состояние')} disabled={working} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={20}/></button></header>
    <p className="muted">{t('Запуск без окна Strata экономит около 1 ГБ памяти. Запущенная модель появится в списке своих провайдеров.')}</p>
    <dl>
      <div><dt>{t('Состояние')}</dt><dd className={job.state==='ready'?'provider-ok':''} role="status">{job.state==='ready'&&<CheckCircle2 size={16}/>}{working&&<Loader2 className="provider-spinner" size={16}/>}{stateText}</dd></div>
      {job.model&&<div><dt>{t('Модель')}</dt><dd>{job.model}</dd></div>}
      {job.state==='ready'&&job.url&&<div><dt>{t('Адрес')}</dt><dd>{job.url}</dd></div>}
    </dl>
    {status.busy&&<Notice tone="warning">{t('Видеокарту уже занимает модель в приложении Strata. Выгрузите её в окне Strata, затем запустите здесь.')}</Notice>}
    {job.state==='error'&&job.error&&<Notice tone="error">{job.error}</Notice>}
    {!running&&<form className="custom-account-form" onSubmit={e=>{e.preventDefault();start();}}>
      <label className="custom-account-field">{t('Модель')}<select value={model} disabled={working||!status.models.length} onChange={e=>setModel(e.target.value)}>{status.models.map(m=><option key={m.id} value={m.id}>{m.id}</option>)}</select></label>
      <label className="custom-account-field">{t('Контекст')}<select value={context} disabled={working} onChange={e=>setContext(Number(e.target.value))}>{contexts.map(c=><option key={c} value={c}>{c/1024}K</option>)}</select></label>
      <label className="custom-account-field">{t('Черновик (ускорение)')}<select value={drafting} disabled={working} onChange={e=>setDrafting(e.target.value as Choice['drafting'])}>{draftings.map(d=><option key={d} value={d}>{draftLabel(d)}</option>)}</select></label>
      {!status.models.length&&<p className="muted">{t('В Strata нет установленных моделей.')}</p>}
      <button className="primary" type="submit" disabled={working||!model||status.busy}>{working?<Loader2 className="provider-spinner" size={16}/>:<Play size={16}/>}{t('Запустить')}</button>
    </form>}
    {running&&<button className="secondary" disabled={working} onClick={()=>void act('/local-models/stop',{})}>{working?<Loader2 className="provider-spinner" size={16}/>:<Square size={16}/>}{t('Остановить')}</button>}
    {error&&<Notice tone="error">{error}</Notice>}
  </article></section>;
}
