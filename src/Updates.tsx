import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { request, type Connection } from './api';
import { t } from './i18n';
import type { Update } from '../server/updates';
import pkg from '../package.json';

import { Installer } from './native-update';
import {HostUpdates,useHostUpdate} from './HostUpdates';
export function Updates({ connection, expanded }: {connection:Connection|null;expanded:boolean}) {
  const hostUpdate=useHostUpdate(connection);
  const [auto, setAuto] = useState(() => {try{return localStorage.getItem('pocket-code-auto-updates-v1') !== 'false';}catch{return true;}});
  const [current, setCurrent] = useState({version:pkg.version,versionCode:15});
  const [settingsSlot,setSettingsSlot] = useState<HTMLElement|null>(null);
  const [update, setUpdate] = useState<Update|null>(null), [busy, setBusy] = useState(''), [error,setError] = useState('');
  const [ready,setReady] = useState<Update|null>(null), [permission,setPermission] = useState(false), [checked,setChecked] = useState(false), [enabled,setEnabled] = useState(true);
  const generation = useRef(0), checking = useRef(false), downloading = useRef(false), attempted = useRef(new Set<string>());
  useEffect(() => {if(Capacitor.isNativePlatform()) void Installer.info().then(setCurrent).catch(()=>{});},[]);
  useEffect(() => {setSettingsSlot(expanded ? document.getElementById('settings-updates') : null);},[expanded]);
  async function check() {
    if(!connection || checking.current || downloading.current) return;
    const epoch = generation.current; checking.current = true;setBusy('check');setError('');
    try {const result = await request<{enabled:boolean;update?:Update}>(connection,'/updates/latest');
      if(epoch !== generation.current) return;
      const next = result.update && result.update.versionCode > current.versionCode ? result.update : null;
      setEnabled(result.enabled);setChecked(true);setUpdate(next);
      setReady(previous => previous && next && previous.sha256 === next.sha256 && previous.versionCode === next.versionCode ? previous : null);
    } catch(e) {if(epoch === generation.current) setError((e as Error).message);}
    finally {checking.current=false;if(epoch === generation.current)setBusy('');}
  }
  useEffect(() => {
    generation.current++;setUpdate(null);setReady(null);setPermission(false);setChecked(false);setError('');setBusy('');
    if(!connection)return;
    const timer = setTimeout(()=>void check(),3000);
    const interval = setInterval(()=>{if(document.visibilityState==='visible')void check();},6*60*60*1000);
    return ()=>{generation.current++;clearTimeout(timer);clearInterval(interval);};
  },[connection,current.versionCode]);
  async function install(target = ready) {
    if(!target)return;
    const epoch = generation.current;
    try {const result = await Installer.install({sha256:target.sha256,versionCode:target.versionCode});if(epoch === generation.current)setPermission(result.needsPermission);}
    catch(e){if(epoch === generation.current)setError((e as Error).message);}
  }
  async function download() {
    if(!connection || !update || busy || downloading.current)return;
    const epoch = generation.current;downloading.current=true;setReady(null);setPermission(false);setBusy('download');setError('');
    try {await Installer.download({...update,...connection});if(epoch !== generation.current)return;setReady(update);await install(update);}
    catch(e){if(epoch === generation.current)setError((e as Error).message);}
    finally {downloading.current=false;if(epoch === generation.current)setBusy('');}
  }
  useEffect(()=>{
    if(!auto || !update || busy || ready || !connection || !Capacitor.isNativePlatform())return;
    const key=connection.url+update.sha256;
    if(attempted.current.has(key))return;
    attempted.current.add(key);void download();
  },[auto,update,busy,ready,connection]);
  if(!expanded && !update)return null;
  const content = <section className={`update-panel${expanded?' expanded':''}`} aria-label={t('Обновления приложения')}>
    <h3>{t('Обновления приложения')}</h3>
    <p className="muted">Pocket Code {current.version}{update ? ` → ${update.version}` : ''}</p>
    {expanded && <label className="checkbox-label"><input type="checkbox" checked={auto} onChange={e=>{setAuto(e.target.checked);try{localStorage.setItem('pocket-code-auto-updates-v1',String(e.target.checked));}catch{}}}/>{t('Автоматически скачивать обновления при подключении к ПК')}</label>}
    {busy && <p role="status">{busy==='download'?t('Скачиваем и проверяем APK…'):t('Проверяем GitHub…')}</p>}
    {error && <p className="error" role="alert">{t(error)}</p>}
    {!update && checked && !error && !busy && <p>{enabled?t('Установлена актуальная версия'):t('Обновления не настроены на ПК')}</p>}
    {update && !Capacitor.isNativePlatform() && <p>{t('Обновление доступно. Установите APK на Android.')}</p>}
    {update && Capacitor.isNativePlatform() && !ready && <button className="primary" disabled={!!busy} onClick={()=>void download()}>{t('Скачать обновление')}</button>}
    {ready && <><p>{t('APK проверен. Подтвердите установку в Android.')}</p>{permission && <button className="secondary" onClick={()=>void Installer.allowInstall().catch(e=>setError(e.message))}>{t('Разрешить установку обновлений')}</button>}<button className="primary" onClick={()=>void install()}>{t('Установить обновление')}</button></>}
    {expanded && <><button className="secondary" disabled={!connection||!!busy} onClick={()=>void check()}>{t('Проверить обновления')}</button><p className="muted">{t('Проверяем GitHub через ваш ПК. Android попросит подтвердить установку; ключи и чаты сохраняются.')}</p></>}
    {expanded&&<HostUpdates update={hostUpdate}/>}
  </section>;
  // Keep one updater mounted while its settings surface joins the normal scroll flow.
  return expanded ? settingsSlot ? createPortal(content,settingsSlot) : null : content;
}
