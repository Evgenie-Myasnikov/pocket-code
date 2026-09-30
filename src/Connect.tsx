import { LanguageSelector } from './Language';
import { t, getLanguage } from "./i18n";import { useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ArrowUpRight, Eye, EyeOff, Laptop, ShieldCheck, Wifi, ArrowRight, Terminal } from 'lucide-react';
import { normalizeUrl, type Connection } from './api';
import { parsePairingCode, readQrImage } from './pairing';
import { ScanLine, ImagePlus } from 'lucide-react';
import './pairing.css';
const QrScanner = registerPlugin<{scan(options: {language: string}): Promise<{value?: string;cancelled?: boolean;}>;}>('PairingScanner');
export function Connect({ initial, onConnect, onDemo, busy, error }: {initial?: Connection | null;onConnect: (c: Connection) => void;onDemo: () => void;busy: boolean;error: string;}) {
  const [url, setUrl] = useState(initial?.url || ''),[token, setToken] = useState(initial?.token || '');
  const [visible, setVisible] = useState(false),[localError, setError] = useState('');
  const [scanning, setScanning] = useState(false),qrFile = useRef<HTMLInputElement>(null);
  function acceptCode(raw: string) {
    const c = parsePairingCode(raw);setUrl(c.url);setToken(c.token);onConnect(c);
  }
  async function scan() {
    if (!Capacitor.isNativePlatform()) {qrFile.current?.click();return;}
    setScanning(true);setError('');
    try {const result = await QrScanner.scan({language: getLanguage()});if (!result.cancelled && result.value) acceptCode(result.value);}
    catch (e) {setError((e as Error).message || t("Не удалось открыть камеру. Можно выбрать изображение QR-кода."));} finally
    {setScanning(false);}
  }
  return <div className="connect-page"><div className="connect-brand"><span className="logo"><Terminal size={22} /></span>Pocket Code <span className="version">ANDROID / 0.9.1</span></div>
    <LanguageSelector /><div className="connection-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="computer-icon"><Laptop size={46} strokeWidth={1.2} /><span className="status-light" /></div><span className="float-tag"><Wifi size={13} /> {t("ВАШЕ РАБОЧЕЕ МЕСТО — ВЕЗДЕ")}</span></div>
    <div className="connect-intro"><div className="eyebrow">{t("ВАШ КОМПЬЮТЕР. ВАШ CLAUDE.")}</div><h1>{t("Большие идеи.")}<br /><span>{t("Маленький экран.")}</span></h1><p>{t("Продолжайте работу с Claude Code на ПК,")}<br className="desktop-only" />{t(" где бы вы ни находились.")}</p></div>
    <div className="qr-connect"><button className="primary" disabled={busy || scanning} onClick={() => void scan()}><ScanLine size={20} />{scanning ? t("Читаем QR-код…") : t("Сканировать QR-код")}</button><button className="text-button" disabled={busy || scanning} onClick={() => qrFile.current?.click()}><ImagePlus size={15} />{t("QR из изображения")}</button><input hidden aria-label={t("Изображение QR-кода")} ref={qrFile} type="file" accept="image/*" onChange={async (e) => {const file = e.target.files?.[0];if (!file) return;setScanning(true);setError('');try {acceptCode(await readQrImage(file));} catch (e) {setError((e as Error).message || t("Не удалось прочитать QR-код"));} finally {setScanning(false);if (qrFile.current) qrFile.current.value = '';}}} /><div className="qr-divider">{t("или введите данные вручную")}</div></div>
    <form className="connect-form" onSubmit={(e) => {e.preventDefault();if (busy || scanning) return;try {setError('');onConnect({ url: normalizeUrl(url), token: token.trim() });} catch (e) {setError((e as Error).message);}}}>
      <label>{t("Адрес компьютера")}<input type="url" required placeholder="http://100.64.0.12:4318" value={url} onChange={(e) => setUrl(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
      <label>{t("Ключ подключения")}<div className="secret-input"><input type={visible ? 'text' : 'password'} required minLength={32} value={token} onChange={(e) => setToken(e.target.value)} placeholder={t("Вставьте ключ с вашего ПК")} autoComplete="off" /><button type="button" className="icon-button" aria-label={visible ? t("Скрыть ключ") : t("Показать ключ")} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
      {(localError || error) && <div className="error" role="alert">{t(localError || error)}</div>}
      <button className="primary connect-button" disabled={busy || scanning}>{busy ? t("Подключаемся…") : t("Подключить компьютер")}<ArrowRight size={18} /></button>
      <p className="security-note"><ShieldCheck size={16} />{t(" Ключ хранится на телефоне. Claude работает на ПК.")}</p>
    </form>
    <details className="setup-help"><summary>{t("Как подключиться в первый раз? ")}<ArrowUpRight size={15} /></summary><ol><li>{t("Для мобильного интернета запустите на ПК ")}<code>Start Pocket Code Internet.cmd</code>{t(". Для одной домашней сети — ")}<code>Start Pocket Code.cmd</code>.</li><li>{t("Закройте прежнее окно сервера перед запуском. Выберите папку проекта и дождитесь страницы с QR-кодом.")}</li><li>{t("Нажмите «Сканировать QR-код» на телефоне. Интернет QR начинается с HTTPS и не требует VPN на телефоне.")}</li></ol><p>{t("ПК и окно сервера должны оставаться включены. Интернет-соединение проходит через Cloudflare. После перезапуска интернет-режима сканируйте новый QR.")}</p></details>
    <button className="text-button demo-button" onClick={onDemo}>{t("Посмотреть интерфейс без подключения ")}<ArrowUpRight size={14} /></button>
    <footer>{t("Независимый клиент для Claude Code · не продукт Anthropic")}</footer>
  </div>;
}
