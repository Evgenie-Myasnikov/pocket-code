import path from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { timingSafeEqual, createHash } from 'node:crypto';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function validToken(actual: string, expected: string) {
  const hash = (s: string) => createHash('sha256').update(s).digest();
  return actual.length > 0 && timingSafeEqual(hash(actual), hash(expected));
}
export function within(root: string, candidate: string) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}
export async function allowedPath(roots: string[], input: string, directory = false) {
  let resolved: string;
  try { resolved = await realpath(input); } catch { throw new HttpError(404, 'Путь не найден на ПК'); }
  if (!roots.some(root => within(root, resolved))) throw new HttpError(403, 'Путь вне разрешённых папок');
  if (directory && !(await stat(resolved)).isDirectory()) throw new HttpError(400, 'Нужна папка проекта');
  return resolved;
}
export function safeFilename(name: string) {
  const clean = path.basename(name.replaceAll('\\', '/')).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(-100);
  return clean && clean !== '.' && clean !== '..' ? clean : 'attachment';
}
