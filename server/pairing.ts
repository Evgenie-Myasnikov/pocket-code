import QRCode from 'qrcode';
import { networkInterfaces } from 'node:os';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
type Address = { url: string; label: string; vpn: boolean; internet?: boolean };
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function pairingAddresses(host: string, port: number, interfaces = networkInterfaces()): Address[] {
  const result: Address[] = [];
  for (const [name, entries] of Object.entries(interfaces)) for (const a of entries || []) {
    if (a.family !== 'IPv4' || a.internal || (host !== '0.0.0.0' && host !== '::' && host !== a.address)) continue;
    const n = a.address.split('.').map(Number);
    const vpn = /tailscale/i.test(name) && n[0] === 100 && n[1] >= 64 && n[1] <= 127;
    // CGNAT addresses also belong to unrelated VPNs; never infer Tailscale from the IP alone.
    if (!vpn && /amnezia|vpn|wireguard|wintun|tun\b|tap\b|vEthernet|docker|vmware|virtualbox|wsl|zerotier/i.test(name)) continue;
    const lan = n[0] === 10 || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && n[1] === 168);
    if ((!vpn && !lan) || result.some(r => r.url === `http://${a.address}:${port}`)) continue;
    result.push({ url: `http://${a.address}:${port}`, label: vpn ? `Tailscale / VPN · ${name}` : `Wi-Fi / локальная сеть · ${name}`, vpn });
  }
  return result.sort((a, b) => Number(b.vpn) - Number(a.vpn));
}
export async function renderPairingPage(addresses: Address[], token: string, port=4318, setupKey?:string,devices=false): Promise<string> {
  const cards = await Promise.all(addresses.map(async (address, i) => {
    const payload = JSON.stringify({ type: 'pocket-code', version: devices?2:1, url: address.url, token });
    const image = await QRCode.toDataURL(payload, { width: 420, margin: 4, errorCorrectionLevel: 'M' });
    return `<article><span class="tag">${i === 0 ? 'ОСНОВНОЕ ПОДКЛЮЧЕНИЕ' : 'ДРУГОЙ АДРЕС'}</span><h2>${escape(address.label)}</h2><img width="320" height="320" src="${image}" alt="QR-код подключения Pocket Code"><code>${escape(address.url)}</code><p>${address.internet ? 'Работает через мобильный интернет или другую сеть. VPN на телефоне не нужен. После перезапуска адрес изменится — отсканируйте новый QR.' : address.vpn ? 'Включите Tailscale на обоих устройствах и подключите их к одной сети Tailscale.' : 'Только для той же домашней сети. Для мобильного интернета запустите Start Pocket Code Internet.cmd на ПК.'}</p></article>`;
  }));
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Подключить телефон · Pocket Code</title><style>body{margin:0;background:#111512;color:#e1e9d9;font:16px system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:45px 24px}h1{font-size:34px;letter-spacing:-1px;margin:12px 0}header p{max-width:670px;line-height:1.7;color:#a3b49a}.brand{color:#c3dda8;font-weight:700;letter-spacing:1px}.cards{display:flex;flex-wrap:wrap;gap:24px;margin-top:30px}article{max-width:360px;padding:24px;background:#1d271b;border:1px solid #3a4c31;border-radius:18px}article img{display:block;width:100%;height:auto;background:white;border-radius:12px;margin:20px 0}h2{font-size:17px;overflow-wrap:anywhere}.tag{font-size:10px;letter-spacing:1.5px;color:#b7cda5}code{display:block;font-size:16px;overflow-wrap:anywhere;color:#d4e9c0}article p,footer{font-size:13px;line-height:1.7;color:#9fb38e}footer{margin-top:28px}.empty{padding:24px;border:1px solid #6f6337;border-radius:12px;color:#dccb99}</style></head><body><main><header><span class="brand">⌘ POCKET CODE</span><h1>Подключите телефон по QR</h1><p>Откройте Pocket Code на телефоне → <b>Сканировать QR-код</b> → наведите камеру на код ниже. Адрес и ключ передадутся автоматически.</p></header>${setupKey ? `<p><a style="color:#c3dda8" target="_blank" rel="noopener noreferrer" href="http://127.0.0.1:${port}/setup/jira#${encodeURIComponent(setupKey)}">Jira &middot; Connect / Settings</a></p>` : ''}<section class="cards">${cards.join('') || '<p class="empty">Нет доступного сетевого адреса. Подключите ПК к Wi-Fi или Tailscale и перезапустите сервер через Start Pocket Code.cmd.</p>'}</section><footer>QR-код содержит ключ доступа к вашему ПК. Не публикуйте его и не отправляйте другим людям.<br>Если включили VPN после запуска сервера, перезапустите сервер, чтобы обновить QR-коды.</footer></main></body></html>`;
}
export async function writePairingPage(directory: string, token: string, host: string, port: number, internetUrl?: string, setupKey?:string,devices=false) {
  const file = path.join(directory, 'pairing.html');
  const addresses = pairingAddresses(host, port);
  if (internetUrl) addresses.unshift({ url: internetUrl, label: 'Через интернет · HTTPS', vpn: false, internet: true });
  await writeFile(file, await renderPairingPage(addresses, token, port, setupKey,devices), { mode: 0o600 });
  return file;
}
