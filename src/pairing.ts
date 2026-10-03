import { t } from "./i18n";import { normalizeUrl, type Connection } from './api';

export function parsePairingCode(raw: string): Connection {
  if (raw.length > 4096) throw new Error(t("Это не QR-код подключения Pocket Code"));
  let data: any;
  try {data = JSON.parse(raw);} catch {throw new Error(t("Это не QR-код подключения Pocket Code"));}
  if (!data || !['pocket-code','pocket-workspace'].includes(data.type) || ![1,2].includes(data.version) || typeof data.url !== 'string' ||
  typeof data.token !== 'string' || !/^[A-Za-z0-9_-]{32,512}$/.test(data.token))
  throw new Error(t("Неверный QR-код. Откройте свежий код на ПК через Start Pocket Code.cmd"));
  if(data.type==='pocket-workspace'&&(typeof data.workspaceId!=='string'||!/^[a-f0-9-]{36}$/.test(data.workspaceId)))throw new Error('Invalid workspace QR');
  return { url: normalizeUrl(data.url), token: data.token,...(data.type==='pocket-workspace'?{workspaceInvite:true,workspaceId:data.workspaceId}:data.version===2?{pairing:true}:{}) };
}

export async function readQrImage(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error(t("Изображение QR-кода должно быть меньше 20 МБ"));
  const { default: jsQR } = await import('jsqr');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error(t("Не удалось прочитать изображение"));
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(pixels.data, pixels.width, pixels.height);
    if (!result) throw new Error(t("QR-код не найден. Выберите чёткое изображение кода целиком."));
    return result.data;
  } finally {bitmap.close();}
}
