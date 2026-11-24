import {useEffect,useRef,useState} from 'react';
import {Cpu,Loader2,Play,Square,RefreshCw,CheckCircle2} from 'lucide-react';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {HelpTip,SettingRow,SettingsBlock,SettingsLine} from './SettingsRows';
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
  const refresh=<button className="icon-button" aria-label={t('Обновить состояние')} title={t('Обновить состояние')} disabled={busy} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={18}/></button>;
  const title=t('Локальная модель (Strata)');
  if(!status)return <SettingsBlock title={title} action={refresh}><SettingsLine>{error?<Notice tone="error">{error}</Notice>:<p role="status">{t('Проверяем локальные модели…')}</p>}</SettingsLine></SettingsBlock>;
  if(!status.available)return <SettingsBlock title={title} action={refresh}><SettingsLine><p>{t('Strata не найдена на этом ПК. Установите её, чтобы запускать локальные модели отсюда.')}</p></SettingsLine></SettingsBlock>;
  const job=status.job,running=job.state==='ready'||status.running.length>0,working=busy||job.state==='starting'||job.state==='stopping';
  async function act(path:'/local-models/start'|'/local-models/stop',body:unknown){setBusy(true);setError('');try{await request(connection!,path,body);}catch(e){setError((e as Error).message);}finally{setBusy(false);setRevision(v=>v+1);}}
  function start(){const choice={model,context,drafting};writeChoice(choice);void act('/local-models/start',choice);}
  const stateText=job.state==='starting'?t('Запускается… Загрузка модели может занять несколько минут.'):job.state==='stopping'?t('Останавливается…'):job.state==='ready'?t('Работает'):job.state==='error'?t('Ошибка запуска'):status.running.length?t('Запущена вне Pocket Code'):t('Остановлена');
  return <SettingsBlock title={title} action={refresh} className="local-model-settings"><form onSubmit={e=>{e.preventDefault();start();}}>
    <SettingRow title={t('Состояние')} note={[job.model,job.state==='ready'?job.url:''].filter(Boolean).join(' · ')||undefined} help={<HelpTip label={t('О локальной модели')}>{t('Запуск без окна Strata экономит около 1 ГБ памяти. Запущенная модель появится в списке своих провайдеров.')}</HelpTip>}>
      <span className={'settings-value'+(job.state==='ready'?' ok':'')} role="status">{job.state==='ready'&&<CheckCircle2 size={16} aria-hidden="true"/>}{working&&<Loader2 className="provider-spinner" size={16} aria-hidden="true"/>}{stateText}</span>
      {running?<button type="button" className="secondary" disabled={working} onClick={()=>void act('/local-models/stop',{})}><Square size={16}/>{t('Остановить')}</button>:<button className="primary" type="submit" disabled={working||!model||status.busy}><Play size={16}/>{t('Запустить')}</button>}
    </SettingRow>
    {status.busy&&<SettingsLine><Notice tone="warning">{t('Видеокарту уже занимает модель в приложении Strata. Выгрузите её в окне Strata, затем запустите здесь.')}</Notice></SettingsLine>}
    {job.state==='error'&&job.error&&<SettingsLine><Notice tone="error">{job.error}</Notice></SettingsLine>}
    {!running&&<>
      <SettingRow title={t('Модель')} htmlFor="local-model-id" note={status.models.length?undefined:t('В Strata нет установленных моделей.')}><select id="local-model-id" value={model} disabled={working||!status.models.length} onChange={e=>setModel(e.target.value)}>{status.models.map(m=><option key={m.id} value={m.id}>{m.id}</option>)}</select></SettingRow>
      <SettingRow title={t('Контекст')} htmlFor="local-model-context"><select id="local-model-context" value={context} disabled={working} onChange={e=>setContext(Number(e.target.value))}>{contexts.map(c=><option key={c} value={c}>{c/1024}K</option>)}</select></SettingRow>
      <SettingRow title={t('Черновик (ускорение)')} htmlFor="local-model-drafting"><select id="local-model-drafting" value={drafting} disabled={working} onChange={e=>setDrafting(e.target.value as Choice['drafting'])}>{draftings.map(d=><option key={d} value={d}>{draftLabel(d)}</option>)}</select></SettingRow>
    </>}
    {error&&<SettingsLine><Notice tone="error">{error}</Notice></SettingsLine>}
  </form></SettingsBlock>;
}
