import QRCode from 'qrcode';
import { networkInterfaces } from 'node:os';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
type Address = { url: string; label: string; vpn: boolean; internet?: boolean; name?: string };
type Language = 'ru' | 'en';
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** The page follows the PC language; a phone switches its own interface separately. */
export function systemLanguage(): Language { const value = process.env.POCKET_LANGUAGE || Intl.DateTimeFormat().resolvedOptions().locale || process.env.LANG || ''; return /^ru/i.test(value) ? 'ru' : 'en'; }
const text = {
  ru: { lan: 'Wi-Fi / локальная сеть', internet: 'Через интернет · HTTPS', recommended: 'Рекомендуется', alt: 'QR-код подключения Pocket Code', internetHint: 'Временная ссылка: работает через мобильный интернет или другую сеть. VPN на телефоне не нужен. После перезапуска адрес изменится — отсканируйте новый QR.', vpnHint: 'Включите Tailscale на обоих устройствах и подключите их к одной сети Tailscale.', lanHint: 'Только для той же домашней сети. Для мобильного интернета включите в Pocket Code на ПК «Подключение через интернет».', title: 'Подключить телефон · Pocket Code', heading: 'Подключите телефон по QR', intro: 'Откройте Pocket Code на телефоне → <b>Сканировать QR-код</b> → наведите камеру на код ниже. Адрес и ключ передадутся автоматически.', empty: 'Нет доступного сетевого адреса. Подключите ПК к Wi-Fi или Tailscale и перезапустите сервер в Pocket Code на ПК.', footer: 'QR-код содержит ключ доступа к вашему ПК. Не публикуйте его и не отправляйте другим людям.<br>Если включили VPN после запуска сервера, перезапустите сервер, чтобы обновить QR-коды.' },
  en: { lan: 'Wi-Fi / local network', internet: 'Internet · HTTPS', recommended: 'Recommended', alt: 'Pocket Code pairing QR code', internetHint: 'Temporary link: works over mobile data or another network. No VPN is needed on the phone. The address changes after a restart, so scan the new QR.', vpnHint: 'Turn on Tailscale on both devices and join them to the same Tailscale network.', lanHint: 'Only for the same home network. For mobile data, turn on “Connect through the internet” in Pocket Code on the PC.', title: 'Connect a phone · Pocket Code', heading: 'Connect your phone with a QR code', intro: 'Open Pocket Code on the phone → <b>Scan QR code</b> → point the camera at a code below. The address and key are transferred automatically.', empty: 'No network address is available. Connect the PC to Wi-Fi or Tailscale and restart the host in Pocket Code on the PC.', footer: 'The QR code contains an access key to your PC. Do not publish it or send it to other people.<br>If you turned on a VPN after the host started, restart the host to refresh the QR codes.' },
};
export function pairingAddresses(host: string, port: number, interfaces = networkInterfaces(), language: Language = 'ru'): Address[] {
  const result: Address[] = [];
  for (const [name, entries] of Object.entries(interfaces)) for (const a of entries || []) {
    if (a.family !== 'IPv4' || a.internal || (host !== '0.0.0.0' && host !== '::' && host !== a.address)) continue;
    const n = a.address.split('.').map(Number);
    const vpn = /tailscale/i.test(name) && n[0] === 100 && n[1] >= 64 && n[1] <= 127;
    // CGNAT addresses also belong to unrelated VPNs; never infer Tailscale from the IP alone.
    if (!vpn && /amnezia|vpn|wireguard|wintun|tun\b|tap\b|vEthernet|docker|vmware|virtualbox|wsl|zerotier/i.test(name)) continue;
    const lan = n[0] === 10 || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && n[1] === 168);
    if ((!vpn && !lan) || result.some(r => r.url === `http://${a.address}:${port}`)) continue;
    const label = vpn ? 'Tailscale' : text[language].lan;
    // An interface named like its type ("Wi-Fi", "Tailscale") adds nothing to the heading.
    const plain = (value: string) => value.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
    result.push({ url: `http://${a.address}:${port}`, label, vpn, ...(plain(name) && !plain(label).includes(plain(name)) ? { name } : {}) });
  }
  return result.sort((a, b) => Number(b.vpn) - Number(a.vpn));
}
/** Jira is hidden until its issues have a place in the app (board cards); POCKET_CODE_JIRA=1 restores the PC setup link for development. */
export const jiraSetupVisible=()=>process.env.POCKET_CODE_JIRA==='1';
export async function renderPairingPage(addresses: Address[], token: string, port=4318, setupKey?:string,devices=false,language:Language='ru'): Promise<string> {
  const l = text[language];
  const cards = await Promise.all(addresses.map(async (address, i) => {
    const payload = JSON.stringify({ type: 'pocket-code', version: devices?2:1, url: address.url, token });
    const image = await QRCode.toDataURL(payload, { width: 420, margin: 4, errorCorrectionLevel: 'M' });
    return `<article>${i === 0 && addresses.length > 1 ? `<span class="tag">${l.recommended}</span>` : ''}<h2>${escape(address.label)}${address.name ? ` <small>${escape(address.name)}</small>` : ''}</h2><img width="320" height="320" src="${image}" alt="${l.alt}"><code>${escape(address.url)}</code><p>${address.internet ? l.internetHint : address.vpn ? l.vpnHint : l.lanHint}</p></article>`;
  }));
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${l.title}</title><style>body{margin:0;background:#111512;color:#e1e9d9;font:16px system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:45px 24px}h1{font-size:34px;letter-spacing:-1px;margin:12px 0}header p{max-width:670px;line-height:1.7;color:#a3b49a}.brand{color:#c3dda8;font-weight:700;letter-spacing:1px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;margin-top:30px}article{padding:24px;background:#1d271b;border:1px solid #3a4c31;border-radius:18px}article img{display:block;width:100%;max-width:360px;height:auto;background:white;border-radius:12px;margin:20px 0}h2{font-size:17px;overflow-wrap:anywhere}h2 small{font-size:13px;font-weight:400;color:#9fb38e}.tag{display:inline-block;font-size:11px;letter-spacing:.5px;color:#111512;background:#c3dda8;border-radius:999px;padding:3px 10px}code{display:block;font-size:16px;overflow-wrap:anywhere;color:#d4e9c0}article p,footer{font-size:13px;line-height:1.7;color:#9fb38e}footer{margin-top:28px;max-width:670px}.empty{grid-column:1/-1;max-width:670px;box-sizing:border-box;line-height:1.7;padding:24px;border:1px solid #6f6337;border-radius:12px;color:#dccb99;margin:0}</style></head><body><main><header><span class="brand">⌘ POCKET CODE</span><h1>${l.heading}</h1><p>${l.intro}</p></header>${setupKey&&jiraSetupVisible() ? `<p><a style="color:#c3dda8" target="_blank" rel="noopener noreferrer" href="http://127.0.0.1:${port}/setup/jira#${encodeURIComponent(setupKey)}">Jira &middot; Connect / Settings</a></p>` : ''}<section class="cards">${cards.join('') || `<p class="empty">${l.empty}</p>`}</section><footer>${l.footer}</footer></main></body></html>`;
}
export async function writePairingPage(directory: string, token: string, host: string, port: number, internetUrl?: string, setupKey?:string,devices=false) {
  const file = path.join(directory, 'pairing.html'), language = systemLanguage();
  const addresses = pairingAddresses(host, port, undefined, language);
  if (internetUrl) addresses.unshift({ url: internetUrl, label: text[language].internet, vpn: false, internet: true });
  await writeFile(file, await renderPairingPage(addresses, token, port, setupKey,devices,language), { mode: 0o600 });
  return file;
}
