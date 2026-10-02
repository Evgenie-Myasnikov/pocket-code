import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Capacitor} from '@capacitor/core';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {Installer} from './native-update';
import {startVisiblePoll} from './visible-poll';
import type {Update} from '../server/updates';
import pkg from '../package.json';

type PCStatus={enabled:boolean;state:'idle'|'checking'|'downloading'|'ready'|'error';update?:Update};
/** Receives the PC's prepared APK. No mobile release checks or PC version upgrades. */
export function Updates({connection,expanded}:{connection:Connection|null;expanded:boolean}){
 const ru=useLanguage()==='ru',l=(en:string,ruText:string)=>ru?ruText:en;
 const [current,setCurrent]=useState<{version:string;versionCode:number}|null>(null),[slot,setSlot]=useState<HTMLElement|null>(null);
 const [pc,setPC]=useState<PCStatus|null>(null),[ready,setReady]=useState<Update|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[permission,setPermission]=useState(false);
 const generation=useRef(0),receiving=useRef(false),attempted=useRef(new Set<string>());
 useEffect(()=>{if(Capacitor.isNativePlatform())void Installer.info().then(setCurrent).catch(()=>setError('Cannot read installed app version.'));},[]);
 useEffect(()=>setSlot(expanded?document.getElementById('settings-updates'):null),[expanded]);
 useEffect(()=>{
  const epoch=++generation.current;setPC(null);setReady(null);setError('');setBusy(false);setPermission(false);
  if(!connection)return;
  const stop=startVisiblePoll(async()=>{try{const value=await request<PCStatus>(connection,'/updates/status');if(!value||typeof value.enabled!=='boolean'||!['idle','checking','downloading','ready','error'].includes(value.state))throw Error();if(epoch===generation.current)setPC(value);}catch{if(epoch===generation.current)setPC(null);}},5000);
  return()=>{generation.current++;stop();};
 },[connection]);
 const update=pc?.state==='ready'&&pc.update&&current&&pc.update.versionCode>current.versionCode?pc.update:null;
 const wanted=useRef<string|null>(null);wanted.current=update?.sha256||null;
 useEffect(()=>{if(update&&ready&&update.sha256!==ready.sha256)setReady(null);},[update?.sha256,ready]);
 async function install(target=ready){if(!target)return;const epoch=generation.current;try{const result=await Installer.install({sha256:target.sha256,versionCode:target.versionCode});if(epoch===generation.current)setPermission(result.needsPermission);}catch{if(epoch===generation.current)setError(l('Android could not open the installer. Retry.','Android не смог открыть установку. Повторите.'));}}
 async function receive(target=update){
  if(!connection||!target||receiving.current)return;const epoch=generation.current;receiving.current=true;setBusy(true);setError('');
  try{await Installer.download({...target,...connection});if(epoch!==generation.current||wanted.current!==target.sha256)return;setReady(target);await install(target);}
  catch{if(epoch===generation.current)setError(l('Could not receive the APK from the PC. Check the connection and retry.','Не удалось получить APK от ПК. Проверьте соединение и повторите.'));}
  finally{receiving.current=false;if(epoch===generation.current)setBusy(false);}
 }
 useEffect(()=>{if(!update||!connection||ready||busy||!Capacitor.isNativePlatform())return;const key=connection.url+'|'+update.sha256;if(attempted.current.has(key))return;attempted.current.add(key);void receive(update);},[update?.sha256,connection,ready,busy]);
 async function check(){if(!connection||busy)return;const epoch=generation.current;setBusy(true);setError('');try{const value=await request<PCStatus>(connection,'/updates/check',{});if(epoch===generation.current)setPC(value);}catch{if(epoch===generation.current)setError(l('Could not ask the PC to check. Update or reconnect the PC app.','Не удалось запустить проверку на ПК. Обновите или подключите приложение ПК.'));}finally{if(epoch===generation.current)setBusy(false);}}
 if(!expanded&&!update&&!ready)return null;
 const content=<section className={`update-panel${expanded?' expanded':''}`} aria-label={l('Updates from PC','Обновления от ПК')}>
  <h3>{l('Updates from PC','Обновления от ПК')}</h3><p className="muted">Pocket Code {current?.version||pkg.version}</p>
  {expanded&&<><p>{l('Your PC checks for updates and sends the APK here. Android asks you to confirm installation.','ПК проверяет обновления и передаёт APK сюда. Android попросит подтвердить установку.')}</p><button className="secondary" disabled={!connection||busy||pc?.state==='checking'||pc?.state==='downloading'} onClick={()=>void check()}>{l('Check for updates on PC','Проверить обновления на ПК')}</button></>}
  <p role="status">{busy&&receiving.current?l('Receiving update from PC…','Получаем обновление от ПК…'):!connection?l('Connect your PC to receive updates.','Подключите ПК для получения обновлений.'):!pc?l('Waiting for the PC. An older host may need updating.','Ожидаем ПК. Старую версию сервера может потребоваться обновить.'):!pc.enabled?l('Updates are not configured on the PC.','Обновления не настроены на ПК.'):pc.state==='checking'?l('The PC is checking for updates…','ПК проверяет обновления…'):pc.state==='downloading'?l('The PC is downloading and verifying the APK…','ПК скачивает и проверяет APK…'):pc.state==='error'?l('The PC could not prepare the update. Retry the check.','ПК не смог подготовить обновление. Повторите проверку.'):update?l('An update is ready on your PC.','Обновление готово на ПК.'):pc.state==='ready'&&!current?l('An update is ready on your PC.','APK готов на ПК.'):pc.state==='ready'?l('Your app is up to date.','Установлена актуальная версия.'):l('The PC has not prepared an update yet.','ПК ещё не подготовил обновление.')}</p>
  {error&&<p className="error" role="alert">{error}</p>}
  {update&&!ready&&<button className="primary" disabled={busy||!Capacitor.isNativePlatform()} onClick={()=>void receive()}>{l('Receive APK from PC','Получить APK от ПК')}</button>}
  {ready&&<>{permission&&<button className="secondary" onClick={()=>void Installer.allowInstall().catch(()=>setError(l('Allow installation in Android settings.','Разрешите установку в настройках Android.')))}>{l('Allow installation','Разрешить установку')}</button>}<button className="primary" onClick={()=>void install()}>{l('Install update','Установить обновление')}</button></>}
 </section>;
 return expanded?slot?createPortal(content,slot):null:content;
}
