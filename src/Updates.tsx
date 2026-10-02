import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Capacitor,CapacitorHttp} from '@capacitor/core';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
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
 const ru=useLanguage()==='ru',l=(en:string,ruText:string)=>ru?ruText:en;
 const [current,setCurrent]=useState<{version:string;versionCode:number}|null>(null),[slot,setSlot]=useState<HTMLElement|null>(null);
 const [pc,setPC]=useState<PCStatus|null>(null),[ready,setReady]=useState<Update|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[permission,setPermission]=useState(false);
 const [pcReachable,setPCReachable]=useState<boolean|null>(null),[release,setRelease]=useState<Update|null>(null),[releaseCheck,setReleaseCheck]=useState<ReleaseCheck>('idle');
 const generation=useRef(0),receiving=useRef(false),attempted=useRef(new Set<string>()),checkingRelease=useRef(false),lastRelease=useRef(0);
 const native=Capacitor.isNativePlatform();
 useEffect(()=>{if(native)void Installer.info().then(setCurrent).catch(()=>setError('Cannot read installed app version.'));},[]);
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
 const wanted=useRef<string|null>(null);wanted.current=update?.sha256||null;
 useEffect(()=>{if(update&&ready&&update.sha256!==ready.sha256)setReady(null);},[update?.sha256,ready]);
 async function install(target=ready){if(!target)return;const epoch=generation.current;try{const result=await Installer.install({sha256:target.sha256,versionCode:target.versionCode});if(epoch===generation.current)setPermission(result.needsPermission);}catch{if(epoch===generation.current)setError(l('Android could not open the installer. Retry.','Android не смог открыть установку. Повторите.'));}}
 async function receive(target=update){
  const fromRelease=direct;
  if(!target||receiving.current||!fromRelease&&!connection)return;const epoch=generation.current;receiving.current=true;setBusy(true);setError('');
  try{if(fromRelease)await Installer.downloadRelease({version:target.version,sha256:target.sha256,size:target.size,versionCode:target.versionCode});else await Installer.download({...target,...connection!});if(epoch!==generation.current||wanted.current!==target.sha256)return;setReady(target);await install(target);}
  catch{if(epoch===generation.current)setError(fromRelease?l('Could not download the update from GitHub. Check the internet connection and retry.','Не удалось скачать обновление с GitHub. Проверьте интернет и повторите.'):l('Could not receive the APK from the PC. Check the connection and retry.','Не удалось получить APK от ПК. Проверьте соединение и повторите.'));}
  finally{receiving.current=false;if(epoch===generation.current)setBusy(false);}
 }
 useEffect(()=>{if(!update||ready||busy||!native||!direct&&!connection)return;const key=(direct?'github':connection!.url)+'|'+update.sha256;if(attempted.current.has(key))return;attempted.current.add(key);void receive(update);},[update?.sha256,connection,direct,ready,busy]);
 async function check(){if(!connection||busy)return;const epoch=generation.current;setBusy(true);setError('');try{const value=await request<PCStatus>(connection,'/updates/check',{});if(epoch===generation.current)setPC(value);}catch{if(epoch===generation.current)setError(l('Could not ask the PC to check. Update or reconnect the PC app.','Не удалось запустить проверку на ПК. Обновите или подключите приложение ПК.'));}finally{if(epoch===generation.current)setBusy(false);}}
 if(!expanded&&!update&&!ready)return null;
 const title=direct?l('Updates','Обновления'):l('Updates from PC','Обновления от ПК');
 const status=direct
  ?busy&&receiving.current?l('Downloading and verifying the update from GitHub…','Скачиваем и проверяем обновление с GitHub…'):releaseCheck==='checking'?l('Checking GitHub for updates…','Проверяем обновления на GitHub…'):releaseCheck==='error'?l('Could not check GitHub. Check the internet connection; the next check runs automatically.','Не удалось проверить GitHub. Проверьте интернет; следующая проверка запустится автоматически.'):update?l('A newer version is available.','Доступна новая версия.'):releaseCheck==='current'?l('Your app is up to date.','Установлена актуальная версия.'):l('Updates are checked automatically while the PC is not connected.','Пока ПК не подключён, обновления проверяются автоматически.')
  :busy&&receiving.current?l('Receiving update from PC…','Получаем обновление от ПК…'):!connection?l('Connect your PC to receive updates.','Подключите ПК для получения обновлений.'):!pc?l('Waiting for the PC. An older host may need updating.','Ожидаем ПК. Старую версию сервера может потребоваться обновить.'):!pc.enabled?l('Updates are not configured on the PC.','Обновления не настроены на ПК.'):pc.state==='checking'?l('The PC is checking for updates…','ПК проверяет обновления…'):pc.state==='downloading'?l('The PC is downloading and verifying the APK…','ПК скачивает и проверяет APK…'):pc.state==='error'?l('The PC could not prepare the update. Retry the check.','ПК не смог подготовить обновление. Повторите проверку.'):update?l('An update is ready on your PC.','Обновление готово на ПК.'):pc.state==='ready'&&!current?l('An update is ready on your PC.','APK готов на ПК.'):pc.state==='ready'?l('Your app is up to date.','Установлена актуальная версия.'):l('The PC has not prepared an update yet.','ПК ещё не подготовил обновление.');
 const content=<section className={`update-panel${expanded?' expanded':''}`} aria-label={title}>
  <h3>{title}</h3><p className="muted">Pocket Code {current?.version||pkg.version}</p>
  {expanded&&(direct
   ?<><p>{l('The PC is not connected, so Pocket Code checks GitHub releases itself and verifies the APK checksum and signature. Android asks you to confirm installation.','ПК не подключён, поэтому Pocket Code сам проверяет релизы на GitHub и сверяет контрольную сумму и подпись APK. Android попросит подтвердить установку.')}</p><button className="secondary" disabled={busy||!current||releaseCheck==='checking'} onClick={()=>void checkRelease(true)}>{l('Check for updates','Проверить обновления')}</button></>
   :<><p>{l('Your PC checks for updates and sends the APK here. Android asks you to confirm installation.','ПК проверяет обновления и передаёт APK сюда. Android попросит подтвердить установку.')}</p><button className="secondary" disabled={!connection||busy||pc?.state==='checking'||pc?.state==='downloading'} onClick={()=>void check()}>{l('Check for updates on PC','Проверить обновления на ПК')}</button></>)}
  <p role="status">{status}</p>
  {error&&<p className="error" role="alert">{error}</p>}
  {update&&!ready&&<button className="primary" disabled={busy||!native} onClick={()=>void receive()}>{direct?l('Download update','Скачать обновление'):l('Receive APK from PC','Получить APK от ПК')}</button>}
  {ready&&<>{permission&&<button className="secondary" onClick={()=>void Installer.allowInstall().catch(()=>setError(l('Allow installation in Android settings.','Разрешите установку в настройках Android.')))}>{l('Allow installation','Разрешить установку')}</button>}<button className="primary" onClick={()=>void install()}>{l('Install update','Установить обновление')}</button></>}
 </section>;
 return expanded?slot?createPortal(content,slot):null:content;
}
