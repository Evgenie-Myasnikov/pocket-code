import { LanguageSelector } from './Language';
import { t, getLanguage } from "./i18n";import { useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ArrowUpRight, Laptop, Wifi, ArrowRight, Terminal } from 'lucide-react';
import { type Connection } from './api';
import { parsePairingCode, readQrImage } from './pairing';
import { ScanLine, ImagePlus } from 'lucide-react';
import pkg from '../package.json';
import './pairing.css';
const QrScanner = registerPlugin<{scan(options: {language: string}): Promise<{value?: string;cancelled?: boolean;}>;}>('PairingScanner');
export function Connect({ initial, onConnect,onAlternateCode, onDemo, busy, error,kind='connection' }: {initial?: Connection | null;onConnect: (c: Connection) => void;onAlternateCode?:(c:Connection)=>void;onDemo?: () => void;busy: boolean;error: string;kind?:'connection'|'workspace';}) {
  const [scanned,setScanned]=useState<Connection|null>(null),[localError,setError]=useState('');
  const [scanning,setScanning]=useState(false),qrFile=useRef<HTMLInputElement>(null);
  const retry=scanned||initial;
  function acceptCode(raw:string){const connection=parsePairingCode(raw);if(!!connection.workspaceInvite!==(kind==='workspace')){if(onAlternateCode){setScanned(null);onAlternateCode(connection);return;}throw Error(t(kind==='workspace'?'Это QR подключения к ПК. Откройте Настройки → Подключение к ПК.':'Это QR рабочей области. Откройте WorkSpace.'));}setScanned(connection);onConnect(connection);}
  async function scan() {
    if (!Capacitor.isNativePlatform()) {qrFile.current?.click();return;}
    setScanning(true);setError('');
    try {const result = await QrScanner.scan({language: getLanguage()});if (!result.cancelled && result.value) acceptCode(result.value);}
    catch (e) {setError((e as Error).message || t("Не удалось открыть камеру. Можно выбрать изображение QR-кода."));} finally
    {setScanning(false);}
  }
  return <div className="connect-page connect-compact"><ScanLine className="connect-symbol" size={32}/><h2>{t(kind==='workspace'?'Присоединиться к рабочей области':'Подключить компьютер')}</h2><p className="muted">{t(kind==='workspace'?'Откройте приглашение WorkSpace на ПК и отсканируйте его QR-код.':'Откройте Настройки → Connection на ПК и отсканируйте QR-код.')}</p><div className="qr-connect"><button className="primary" disabled={busy || scanning} onClick={() => void scan()}><ScanLine size={20} />{scanning ? t("Читаем QR-код…") : t("Сканировать QR-код")}</button><button className="text-button" disabled={busy || scanning} onClick={() => qrFile.current?.click()}><ImagePlus size={15} />{t("QR из изображения")}</button><input hidden aria-label={t("Изображение QR-кода")} ref={qrFile} type="file" accept="image/*" onChange={async (e) => {const file = e.target.files?.[0];if (!file) return;setScanning(true);setError('');try {acceptCode(await readQrImage(file));} catch (e) {setError((e as Error).message || t("Не удалось прочитать QR-код"));} finally {setScanning(false);if (qrFile.current) qrFile.current.value = '';}}} /></div>
    {(localError || error) && <div className="error" role="alert">{t(localError || error)}</div>}
    {busy && <p role="status">{t("Подключаемся…")}</p>}
    {retry && !busy && <button className="primary connect-button" disabled={scanning} onClick={()=>{setError('');onConnect(retry);}}>{t("Reconnect")}<ArrowRight size={18}/></button>}
    {onDemo&&<button className="text-button demo-button" onClick={onDemo}>{t("Посмотреть интерфейс без подключения ")}<ArrowUpRight size={14} /></button>}
  </div>;
}
