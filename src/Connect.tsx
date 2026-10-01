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
export function Connect({ initial, onConnect, onDemo, busy, error }: {initial?: Connection | null;onConnect: (c: Connection) => void;onDemo: () => void;busy: boolean;error: string;}) {
  const [scanned,setScanned]=useState<Connection|null>(null),[localError,setError]=useState('');
  const [scanning,setScanning]=useState(false),qrFile=useRef<HTMLInputElement>(null);
  const retry=scanned||initial;
  function acceptCode(raw:string){const connection=parsePairingCode(raw);setScanned(connection);onConnect(connection);}
  async function scan() {
    if (!Capacitor.isNativePlatform()) {qrFile.current?.click();return;}
    setScanning(true);setError('');
    try {const result = await QrScanner.scan({language: getLanguage()});if (!result.cancelled && result.value) acceptCode(result.value);}
    catch (e) {setError((e as Error).message || t("Не удалось открыть камеру. Можно выбрать изображение QR-кода."));} finally
    {setScanning(false);}
  }
  return <div className="connect-page"><div className="connect-brand"><span className="logo"><Terminal size={22} /></span>Pocket Code <span className="version">ANDROID / {pkg.version}</span></div>
    <LanguageSelector /><div className="connection-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="computer-icon"><Laptop size={46} strokeWidth={1.2} /><span className="status-light" /></div><span className="float-tag"><Wifi size={13} /> {t("ВАШЕ РАБОЧЕЕ МЕСТО — ВЕЗДЕ")}</span></div>
    <div className="connect-intro"><div className="eyebrow">{t("CLAUDE И CODEX НА ВАШЕМ ПК")}</div><h1>{t("Большие идеи.")}<br /><span>{t("Маленький экран.")}</span></h1><p>{t("Продолжайте работу с Claude Code и Codex на ПК,")}<br className="desktop-only" />{t(" где бы вы ни находились.")}</p></div>
    <div className="qr-connect"><button className="primary" disabled={busy || scanning} onClick={() => void scan()}><ScanLine size={20} />{scanning ? t("Читаем QR-код…") : t("Сканировать QR-код")}</button><button className="text-button" disabled={busy || scanning} onClick={() => qrFile.current?.click()}><ImagePlus size={15} />{t("QR из изображения")}</button><input hidden aria-label={t("Изображение QR-кода")} ref={qrFile} type="file" accept="image/*" onChange={async (e) => {const file = e.target.files?.[0];if (!file) return;setScanning(true);setError('');try {acceptCode(await readQrImage(file));} catch (e) {setError((e as Error).message || t("Не удалось прочитать QR-код"));} finally {setScanning(false);if (qrFile.current) qrFile.current.value = '';}}} /></div>
    {(localError || error) && <div className="error" role="alert">{t(localError || error)}</div>}
    {busy && <p role="status">{t("Подключаемся…")}</p>}
    {retry && !busy && <button className="primary connect-button" disabled={scanning} onClick={()=>{setError('');onConnect(retry);}}>{t("Reconnect")}<ArrowRight size={18}/></button>}
    <button className="text-button demo-button" onClick={onDemo}>{t("Посмотреть интерфейс без подключения ")}<ArrowUpRight size={14} /></button>
  </div>;
}
