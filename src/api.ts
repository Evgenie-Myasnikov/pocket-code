import { t } from "./i18n";import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { networkFailure } from './connection-errors';
import {desktopCall} from './desktop-bridge';
import {cacheable,readOffline,writeOffline,clearConnectionOffline} from './offline-data';
export type Connection = {url: string;token: string;desktop?:boolean;pairing?:boolean;deviceId?:string;workspaceId?:string;workspaceInvite?:boolean;workspaceOnly?:boolean;workspaceAccesses?:{url:string;token:string;workspaceId?:string;deviceId?:string;name?:string}[];workspaceAccess?:{url:string;token:string;workspaceId?:string;deviceId?:string;name?:string};};
let pairing:{key:string;promise:Promise<Connection>}|undefined;
// A stable installation id lets the PC replace this device's entry when it pairs again; the name tells devices apart.
async function deviceIdentity(platform:'android'|'browser'):Promise<{name:string;model?:string;installation?:string}>{
  if(platform==='android'&&Capacitor.isNativePlatform())try{const {Installer}=await import('./native-update');const device=await Installer.identity();return {name:device.name||device.model||'Android device',...(device.model?{model:device.model}:{}),...(device.installation?{installation:device.installation}:{})};}catch{/* Older native builds pair without an identity. */}
  let installation:string|undefined;try{installation=localStorage.getItem('pocket-code-installation')||undefined;if(!installation){installation=crypto.randomUUID().replace(/-/g,'');localStorage.setItem('pocket-code-installation',installation);}}catch{installation=undefined;}
  return {name:platform==='android'?'Android device':'Browser',...(installation?{installation}:{})};
}
export function pairDevice(connection:Connection,version:string):Promise<Connection>{
  if(!connection.pairing)return Promise.resolve(connection);
  const key=connection.url+'|'+connection.token;if(pairing?.key===key)return pairing.promise;
  const platform=/Android/i.test(navigator.userAgent)?'android':'browser';
  const promise=deviceIdentity(platform).then(identity=>request<{deviceId?:string;token:string;workspaceId?:string}>(connection,'/devices/pair',{...identity,platform,version})).then(paired=>({url:connection.url,...paired})).catch(error=>{if(pairing?.key===key)pairing=undefined;throw error;}).finally(()=>{if(pairing?.promise===promise)pairing=undefined;});
  pairing={key,promise};return promise;
}
export function providerRequest(provider:'claude'|'codex'|'copilot'){
  return <T,>(connection:Connection,endpoint:string,data?:unknown):Promise<T>=>{
    const [pathname,search]=endpoint.split('?');const params=new URLSearchParams(search);
    if(!params.has('provider'))params.set('provider',provider);
    return request<T>(connection,pathname+'?'+params,data&&typeof data==='object'?{provider,...data}:data);
  };
}
const Vault = registerPlugin<{load(): Promise<{value?: string;}>;save(options: {value: string;}): Promise<void>;clear(): Promise<void>;}>('ConnectionVault');
export function normalizeUrl(value: string) {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' && url.pathname !== '') throw new Error(t("Введите только адрес сервера и порт"));
  const host = url.hostname;
  const octets = host.split('.').map(Number);
  const privateIP = octets.length === 4 && octets.every((n) => Number.isInteger(n) && n >= 0 && n < 256) && (
  octets[0] === 10 || octets[0] === 127 || octets[0] === 192 && octets[1] === 168 ||
  octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 || octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (privateIP || host === 'localhost' || host === '[::1]')))
  throw new Error(t("Для интернета нужен HTTPS или приватный IP Tailscale. В Wi-Fi используйте локальный IP ПК."));
  return url.origin;
}
export async function loadConnection(): Promise<Connection | null> {
  const raw = Capacitor.isNativePlatform() ? (await Vault.load()).value : sessionStorage.getItem('connection');
  return raw ? JSON.parse(raw) : null;
}
export async function saveConnection(connection: Connection | null) {
  if(!connection)pairing=undefined;
  if (Capacitor.isNativePlatform()) {
    if (connection) await Vault.save({ value: JSON.stringify(connection) });else await Vault.clear();
  } else if (connection) sessionStorage.setItem('connection', JSON.stringify(connection));else sessionStorage.removeItem('connection');
}
export async function request<T>(connection: Connection, endpoint: string, data?: unknown): Promise<T> {
  if(connection.desktop)return desktopCall<T>(data===undefined?'read':'write',{endpoint,...(data===undefined?{}:{data})});
  const timeout = endpoint.startsWith('/jira/workflow') ? 300000 : endpoint.startsWith('/jira/') || endpoint.startsWith('/updates/') || endpoint.startsWith('/providers') || endpoint.endsWith('/usage') || endpoint.includes('provider=codex') ? 95000 : 30000;
  const url = normalizeUrl(connection.url) + '/api' + endpoint;
  const headers = { Authorization: `Bearer ${connection.token}`, 'Content-Type': 'application/json' };
  let status: number, body: any;
  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.request({ url, headers, method: data === undefined ? 'GET' : 'POST',
        data, responseType: 'json', connectTimeout: 10000, readTimeout: timeout, disableRedirects: true });
      status = response.status;body = response.data;
    } else {
      const response = await fetch(url, { headers, method: data === undefined ? 'GET' : 'POST',
        body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(timeout), redirect: 'error' });
      status = response.status;body = status === 204 ? null : await response.text();
    }
  } catch (error) {if(data===undefined&&cacheable(endpoint)){const cached=await readOffline(connection,endpoint);if(cached!==undefined){window.dispatchEvent(new CustomEvent('pocket-offline-read'));return cached as T;}}throw new Error(networkFailure(url, error));}
  if (status === 204) return null as T;
  if (typeof body === 'string') {try {body = JSON.parse(body);} catch {body = null;}}
  if (status >= 500) throw Object.assign(new Error(t("Сервер или интернет-туннель пока недоступен (HTTP {0}). Убедитесь, что окно сервера открыто; повторите подключение или отсканируйте новый QR после перезапуска.", status)),{status});
  if(status===401||status===403){await clearConnectionOffline(connection);if(status===401&&connection.deviceId)window.dispatchEvent(new CustomEvent('pocket-device-revoked',{detail:connection.deviceId}));}
  if (status < 200 || status >= 300) throw Object.assign(new Error(body?.error || t("Ошибка подключения ({0})", status)),{status});
  if (body === null || typeof body !== 'object') throw new Error(t("По этому адресу ответил другой сервис. Отсканируйте свежий QR Pocket Code."));
  if(data===undefined&&cacheable(endpoint)){if(endpoint.startsWith('/workspaces')&&body.workspaces?.some((ws:any)=>ws.me?.approval&&ws.me.approval!=='approved'))await clearConnectionOffline(connection);await writeOffline(connection,endpoint,body);window.dispatchEvent(new CustomEvent('pocket-online-read'));}
  return body as T;
}
export async function fileBase64(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error(t("Один файл — не больше 10 МБ"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error(t("Не удалось прочитать файл")));reader.readAsDataURL(file);
  });
}
