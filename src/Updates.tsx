import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Capacitor,CapacitorHttp} from '@capacitor/core';
import {request,type Connection} from './api';
import {t,useLanguage} from './i18n';
import {ChevronDown} from 'lucide-react';
import {Notice} from './Notice';
import {publishUpdate} from './live-settings';
import {Installer} from './native-update';
import {startVisiblePoll} from './visible-poll';
import {latestPublishedUpdate,type Update} from './release-update';
import pkg from '../package.json';

type PCStatus={enabled:boolean;state:'idle'|'checking'|'downloading'|'ready'|'error';update?:Update};
type ReleaseCheck='idle'|'checking'|'current'|'error';
const releaseInterval=60*60*1000;
async function githubJson(url:string){
 const response=await CapacitorHttp.get({url,headers:{Accept:'application/vnd.github+json','User-Agent':'Pocket-Code-Updater'},connectTimeout:15000,readTimeout:30000});
 if(response.status!==200)throw Error('Release check failed');
 return typeof response.data==='string'?JSON.parse(response.data):response.data;
}
/** Receives the PC's prepared APK. Without a reachable PC the phone checks the public release itself; Android verifies checksum and signing certificate either way. */
export function Updates({connection,expanded}:{connection:Connection|null;expanded:boolean}){
 useLanguage();
 const [current,setCurrent]=useState<{version:string;versionCode:number}|null>(null),[slot,setSlot]=useState<HTMLElement|null>(null);
 const [pc,setPC]=useState<PCStatus|null>(null),[ready,setReady]=useState<Update|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[permission,setPermission]=useState(false);
 const [pcReachable,setPCReachable]=useState<boolean|null>(null),[release,setRelease]=useState<Update|null>(null),[releaseCheck,setReleaseCheck]=useState<ReleaseCheck>('idle');
 const generation=useRef(0),receiving=useRef(false),attempted=useRef(new Set<string>()),checkingRelease=useRef(false),lastRelease=useRef(0);
 const native=Capacitor.isNativePlatform();
 useEffect(()=>{if(native)void Installer.info().then(setCurrent).catch(()=>setError(t('Не удалось прочитать версию установленного приложения.')));},[]);
 useEffect(()=>setSlot(expanded?document.getElementById('settings-updates'):null),[expanded]);
 useEffect(()=>{
  const epoch=++generation.current;setPC(null);setPCReachable(null);setReady(null);setError('');setBusy(false);setPermission(false);
  if(!connection)return;
  const stop=startVisiblePoll(async()=>{try{const value=await request<PCStatus>(connection,'/updates/status');if(!value||typeof value.enabled!=='boolean'||!['idle','checking','downloading','ready','error'].includes(value.state))throw Error();if(epoch===generation.current){setPC(value);setPCReachable(true);}}catch{if(epoch===generation.current){setPC(null);setPCReachable(false);}}},5000);
  return()=>{generation.current++;stop();};
 },[connection]);
 // The PC stays the update source while it answers; otherwise the phone must not miss releases.
 const direct=native&&(!connection||pcReachable===false||pc?.enabled===false);
 async function checkRelease(force=false){
  if(!native||!current||checkingRelease.current||!force&&Date.now()-lastRelease.current<releaseInterval)return;
  checkingRelease.current=true;lastRelease.current=Date.now();setReleaseCheck('checking');
  try{setRelease(await latestPublishedUpdate(githubJson));setReleaseCheck('current');}
  catch{setReleaseCheck('error');}
  finally{checkingRelease.current=false;}
 }
 useEffect(()=>{if(!direct||!current)return;return startVisiblePoll(()=>checkRelease(),releaseInterval);},[direct,current?.versionCode]);
 const pcUpdate=pc?.state==='ready'&&pc.update&&current&&pc.update.versionCode>current.versionCode?pc.update:null;
 const update=direct?release&&current&&release.versionCode>current.versionCode?release:null:pcUpdate;
 // The settings index and the Settings tab show a dot while a newer version waits.
 useEffect(()=>{publishUpdate(update?update.version:null);},[update?.version]);
 const wanted=useRef<string|null>(null);wanted.current=update?.sha256||null;
 useEffect(()=>{if(update&&ready&&update.sha256!==ready.sha256)setReady(null);},[update?.sha256,ready]);
 async function install(target=ready){if(!target)return;const epoch=generation.current;try{const result=await Installer.install({sha256:target.sha256,versionCode:target.versionCode});if(epoch===generation.current)setPermission(result.needsPermission);}catch{if(epoch===generation.current)setError(t('Android не смог открыть установку. Повторите.'));}}
 async function receive(target=update){
  const fromRelease=direct;
  if(!target||receiving.current||!fromRelease&&!connection)return;const epoch=generation.current;receiving.current=true;setBusy(true);setError('');
  try{if(fromRelease)await Installer.downloadRelease({version:target.version,sha256:target.sha256,size:target.size,versionCode:target.versionCode});else await Installer.download({...target,...connection!});if(epoch!==generation.current||wanted.current!==target.sha256)return;setReady(target);await install(target);}
  catch{if(epoch===generation.current)setError(fromRelease?t('Не удалось скачать обновление с GitHub. Проверьте интернет и повторите.'):t('Не удалось получить APK от ПК. Проверьте соединение и повторите.'));}
  finally{receiving.current=false;if(epoch===generation.current)setBusy(false);}
 }
 useEffect(()=>{if(!update||ready||busy||!native||!direct&&!connection)return;const key=(direct?'github':connection!.url)+'|'+update.sha256;if(attempted.current.has(key))return;attempted.current.add(key);void receive(update);},[update?.sha256,connection,direct,ready,busy]);
 async function check(){if(!connection||busy)return;const epoch=generation.current;setBusy(true);setError('');try{const value=await request<PCStatus>(connection,'/updates/check',{});if(epoch===generation.current)setPC(value);}catch{if(epoch===generation.current)setError(t('Не удалось запустить проверку на ПК. Обновите или подключите приложение ПК.'));}finally{if(epoch===generation.current)setBusy(false);}}
 if(!expanded&&!update&&!ready)return null;
 const title=direct?t('Из GitHub'):t('Обновления от ПК');
 const status=direct
  ?busy&&receiving.current?t('Скачиваем и проверяем обновление с GitHub…'):releaseCheck==='checking'?t('Проверяем обновления на GitHub…'):releaseCheck==='error'?t('Не удалось проверить GitHub. Проверьте интернет; следующая проверка запустится автоматически.'):update?t('Доступна новая версия.'):releaseCheck==='current'?t('Установлена актуальная версия.'):t('Пока ПК не подключён, обновления проверяются автоматически.')
  :busy&&receiving.current?t('Получаем обновление от ПК…'):!connection?t('Подключите ПК для получения обновлений.'):!pc?t('Ожидаем ПК. Старую версию сервера может потребоваться обновить.'):!pc.enabled?t('Обновления не настроены на ПК.'):pc.state==='checking'?t('ПК проверяет обновления…'):pc.state==='downloading'?t('ПК скачивает и проверяет APK…'):pc.state==='error'?t('ПК не смог подготовить обновление. Повторите проверку.'):update?t('Обновление готово на ПК.'):pc.state==='ready'&&!current?t('APK готов на ПК.'):pc.state==='ready'?t('Установлена актуальная версия.'):t('ПК ещё не подготовил обновление.');
 const content=<section className={`update-panel${expanded?' expanded':''}`} aria-label={title}>
  <h3>{title}</h3><p className="muted">Pocket Code {current?.version||pkg.version}</p>
  {expanded&&(direct
   ?<><p>{t('ПК не отвечает, поэтому Pocket Code сам проверяет релизы на GitHub.')}</p><details className="disclosure"><summary><ChevronDown className="disclosure-chevron" size={18} aria-hidden="true"/>{t('Подробнее о проверке')}</summary><p className="muted">{t('ПК не подключён, поэтому Pocket Code сам проверяет релизы на GitHub и сверяет контрольную сумму и подпись APK. Android попросит подтвердить установку.')}</p></details><button className="secondary" disabled={busy||!current||releaseCheck==='checking'} onClick={()=>void checkRelease(true)}>{t('Проверить обновления')}</button></>
   :<><p>{t('ПК проверяет обновления и передаёт APK сюда. Android попросит подтвердить установку.')}</p><button className="secondary" disabled={!connection||busy||pc?.state==='checking'||pc?.state==='downloading'} onClick={()=>void check()}>{t('Проверить обновления на ПК')}</button></>)}
  <p role="status">{status}</p>
  {error&&<Notice tone="error" action={update&&!ready&&!busy?<button className="secondary" onClick={()=>void receive()}>{t('Повторить')}</button>:undefined}>{error}</Notice>}
  {update&&!ready&&<button className="primary" disabled={busy||!native} onClick={()=>void receive()}>{direct?t('Скачать обновление'):t('Получить APK от ПК')}</button>}
  {ready&&<>{permission&&<button className="secondary" onClick={()=>void Installer.allowInstall().catch(()=>setError(t('Разрешите установку в настройках Android.')))}>{t('Разрешить установку')}</button>}<button className="primary" onClick={()=>void install()}>{t('Установить обновление')}</button></>}
 </section>;
 return expanded?slot?createPortal(content,slot):null:content;
}
