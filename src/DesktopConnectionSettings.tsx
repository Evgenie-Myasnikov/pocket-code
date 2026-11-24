import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {Wifi} from 'lucide-react';
import {t,useLanguage} from './i18n';
import {desktopCall,type DesktopState} from './desktop-bridge';
import {connectionKind} from './connection-kind';
import {releaseRepository} from './release-update';
import {DesktopDevices,type Device} from './DesktopDevices';
import {SettingRow,SettingsBlock,SettingsLine,SwitchRow} from './SettingsRows';
import type {Connection} from './api';

const host:Connection={url:'http://127.0.0.1:4318',token:'',desktop:true};
const rotation=90;
/** Connection and startup in the PC window: phone access switches, the pairing QR, devices and the Windows app, each group one card of rows. */
export function DesktopConnectionSettings({state,action}:{state:DesktopState;action:(command:string,args?:Record<string,unknown>)=>Promise<void>}){
  useLanguage();
  const [address,setAddress]=useState(0),[phones,setPhones]=useState(0),[hidden,setHidden]=useState(()=>document.visibilityState==='hidden'),[left,setLeft]=useState(rotation),[install,setInstall]=useState('');
  // A rotated QR arrives as the reply to pairing-rotate; the next state the window receives replaces it.
  const [rotated,setRotated]=useState<DesktopState['addresses']|null>(null);
  useEffect(()=>setRotated(null),[state]);
  const addresses=rotated||state.addresses;
  const supportsPhoneSetting=state.phoneAccess!==undefined;
  const sharing=state.online&&(state.activePhoneAccess??!supportsPhoneSetting);
  const pairing=sharing?addresses[Math.min(address,addresses.length-1)]:undefined;
  useEffect(()=>{const update=()=>setHidden(document.visibilityState==='hidden');document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  // While this page is open the QR changes every 90 s, so an old photo of it cannot pair a device later.
  useEffect(()=>{if(!sharing||!addresses.length||hidden)return;setLeft(rotation);const timer=setInterval(()=>setLeft(value=>{if(value>1)return value-1;void desktopCall<DesktopState>('pairing-rotate').then(next=>{if(next?.addresses)setRotated(next.addresses);}).catch(()=>{});return rotation;}),1000);return()=>clearInterval(timer);},[sharing,addresses.length>0,hidden]);
  useEffect(()=>{if(!sharing)return;void QRCode.toDataURL('https://github.com/'+releaseRepository+'/releases/latest',{width:240,margin:2}).then(setInstall).catch(()=>{});},[sharing]);
  const routeName=(url:string)=>({Tailscale:'Tailscale',Local:t('Та же сеть Wi-Fi'),Internet:t('Интернет (временный)'),Unknown:t('Другой адрес')} as Record<string,string>)[connectionKind(url)];
  const restartNote=t('Применяется при следующем запуске локального сервера');
  return <>
    <SettingsBlock title={t('Доступ с телефона')}>
      {supportsPhoneSetting&&<SwitchRow title={t('Разрешить доступ с телефона')} note={restartNote} checked={!!state.phoneAccess} disabled={state.busy} onChange={value=>void action('settings',{phoneAccess:value})}/>}
      {supportsPhoneSetting&&state.online&&state.activePhoneAccess!==undefined&&state.activePhoneAccess!==state.phoneAccess&&<SettingsLine><p role="status">{state.activePhoneAccess?t('В текущем сеансе сервера доступ с телефона ещё активен.'):t('Доступ с телефона включён в настройках. Подключение с телефона пока недоступно.')}</p></SettingsLine>}
      {sharing&&<SettingRow title={t('Сервер ПК')}><span className="settings-value ok"><span className="settings-dot on" aria-hidden="true"/>{state.hostBusy?t('В работе'):t('В сети')}</span></SettingRow>}
      {sharing&&state.internet&&<SettingRow title={t('Интернет-туннель')}><span className={'settings-value'+(state.tunnelOnline?' ok':'')}><span className={'settings-dot'+(state.tunnelOnline?' on':'')} aria-hidden="true"/>{state.tunnelOnline?t('Подключён'):t('Не подключён')}</span></SettingRow>}
      {(state.phoneAccess??true)&&<SwitchRow title={t('Подключение через интернет')} note={restartNote} checked={state.internet} disabled={state.busy||(!supportsPhoneSetting&&state.online)} onChange={value=>void action('settings',{internet:value})}/>}
      {state.keepAwake!==undefined&&<SwitchRow title={t('Не давать ПК засыпать')} note={t('Пока работают агенты или подключён телефон; только от сети')} checked={state.keepAwake} onChange={value=>void action('settings',{keepAwake:value})}/>}
    </SettingsBlock>
    {sharing&&<SettingsBlock label={t('Подключение телефона')}>
      <div className="settings-pairing">
        <div className={'desktop-qr'+(hidden?' concealed':'')}>{pairing?<img src={pairing.image} alt={t('Личный QR подключения')}/>:<Wifi size={48}/>}</div>
        <div className="settings-pairing-text">
          <h4>{phones?t('Подключить ещё телефон'):t('Подключите телефон')}</h4>
          <p>{pairing?t('Отсканируйте QR в Pocket Code на Android.'):t('Ожидаем адрес для подключения…')}</p>
          {addresses.length>0&&<div className="desktop-routes" role="group" aria-label={t('Адрес подключения')}>{addresses.map((item,index)=><button key={item.url} className="desktop-route" aria-pressed={index===Math.min(address,addresses.length-1)} title={connectionKind(item.url)==='Internet'?t('Временная ссылка: меняется после перезапуска'):item.url} onClick={()=>setAddress(index)}><strong>{routeName(item.url)}</strong></button>)}</div>}
          {pairing&&<p className="desktop-qr-timer" role="timer">{hidden?t('QR скрыт, пока окно в фоне.'):t('QR обновится через {0} с и после каждого подключения.',left)}</p>}
        </div>
      </div>
      <SettingRow title={t('Приложение для Android')} note={t('Отсканируйте, чтобы открыть последний релиз и скачать APK')}>{install&&<img className="settings-install-qr" src={install} alt={t('QR-код для загрузки Android-приложения')}/>}</SettingRow>
    </SettingsBlock>}
    {sharing&&<DesktopDevices connection={host} online={state.online} onDevices={(list:Device[])=>setPhones(list.filter(item=>item.status==='online').length)}/>}
    <SettingsBlock title={t('Приложение Windows')}>
      <SwitchRow title={t('Запускать с Windows')} note={t('Закрытие окна оставляет Pocket Code в трее; выход — из меню трея')} checked={state.startup} onChange={value=>void action('settings',{startup:value})}/>
      <SwitchRow title={t('Перезапускать локальный сервер после сбоя')} checked={state.autoReconnect} onChange={value=>void action('settings',{autoReconnect:value})}/>
    </SettingsBlock>
  </>;
}
