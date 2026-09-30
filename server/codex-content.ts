import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { allowedPath } from './security.js';
import type { Block, ChatMessage } from './types.js';

const imageTypes: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
function inlineImage(value: unknown): Block | null {
  if (typeof value !== 'string' || value.length > 12_000_000) return null;
  const dataUrl = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/\r\n]*={0,2})$/.exec(value);
  if (dataUrl) return { type: 'image', source: { type: 'base64', media_type: dataUrl[1], data: dataUrl[2] } };
  if (/^[A-Za-z0-9+/\r\n]+={0,2}$/.test(value)) {
    const prefix = Buffer.from(value.slice(0, 48), 'base64');
    const mime = prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
      : prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255 ? 'image/jpeg'
      : prefix.subarray(0, 3).toString() === 'GIF' ? 'image/gif'
      : prefix.subarray(0, 4).toString() === 'RIFF' && prefix.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null;
    if (mime) return { type: 'image', source: { type: 'base64', media_type: mime, data: value } };
  }
  if (/^https?:\/\//i.test(value)) return { type: 'image', source: { type: 'url', url: value } };
  return null;
}
export async function localImageBlock(roots: string[], file: string): Promise<Block | null> {
  try {
    const resolved = await allowedPath(roots, file), mime = imageTypes[path.extname(resolved).toLowerCase()];
    if (!mime || (await stat(resolved)).size > 8_000_000) return null;
    const data = await readFile(resolved);
    return { type: 'image', source: { type: 'base64', media_type: mime, data: data.toString('base64') } };
  } catch { return null; }
}
function outputBlocks(content: unknown): Block[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  if (!Array.isArray(content)) return [{ type: 'text', text: JSON.stringify(content ?? '') }];
  return content.map((item: any) => {
    if (item?.type === 'image' && typeof item.data === 'string' && imageTypes[`.${item.mimeType?.split('/')[1]}`])
      return { type: 'image', source: { type: 'base64', data: item.data, media_type: item.mimeType } };
    if (item?.type === 'text' && typeof item.text === 'string') return { type: 'text', text: item.text };
    return { type: 'codexContent', content: item };
  });
}
/** Only the model's public reasoning summary is displayed, never internal reasoning content. */
export async function codexMessage(item: any, roots: string[]): Promise<ChatMessage | null> {
  if (!item || typeof item.id !== 'string') return null;
  let blocks: Block[] = [], role: ChatMessage['role'] = 'assistant';
  switch (item.type) {
    case 'userMessage':
      role = 'user';
      for (const part of item.content || []) {
        if (part.type === 'text') blocks.push({ type: 'text', text: part.text });
        else if (part.type === 'localImage') blocks.push(await localImageBlock(roots, part.path) || { type: 'text', text: `[Image: ${path.basename(part.path)}]` });
        else if (part.type === 'image' && typeof part.url === 'string') blocks.push(inlineImage(part.url) || { type: 'text', text: '[Image unavailable]' });
        else blocks.push({ type: 'codexInput', content: part });
      }
      break;
    case 'agentMessage': case 'plan': blocks = [{ type: 'text', text: item.text || '' }]; break;
    case 'reasoning':
      if (!item.summary?.length) return null;
      blocks = [{ type: 'thinking', thinking: item.summary.join('\n\n') }]; break;
    case 'commandExecution':
      blocks = [{ type: 'tool_use', id: item.id, name: 'Command', input: { command: item.command, cwd: item.cwd, status: item.status } }];
      if (item.aggregatedOutput != null) blocks.push({ type: 'tool_result', tool_use_id: item.id, content: item.aggregatedOutput, is_error: item.status === 'failed' || (item.exitCode != null && item.exitCode !== 0) });
      break;
    case 'fileChange': blocks = [{ type: 'tool_use', id: item.id, name: 'File changes', input: { changes: item.changes, status: item.status } }]; break;
    case 'mcpToolCall':
      blocks = [{ type: 'tool_use', id: item.id, name: `${item.server}/${item.tool}`, input: item.arguments }];
      if (item.result) blocks.push({ type: 'tool_result', tool_use_id: item.id, content: outputBlocks(item.result.content ?? item.result), is_error: Boolean(item.result.isError) });
      if (item.error) blocks.push({ type: 'tool_result', tool_use_id: item.id, content: item.error.message || 'Tool failed', is_error: true });
      break;
    case 'dynamicToolCall':
      blocks = [{ type: 'tool_use', id: item.id, name: item.tool, input: item.arguments }];
      if (item.contentItems) blocks.push({ type: 'tool_result', tool_use_id: item.id, content: outputBlocks(item.contentItems), is_error: item.success === false });
      break;
    case 'functionCallOutput': blocks = [{ type: 'tool_result', tool_use_id: item.id, content: outputBlocks(item.output) }]; break;
    case 'imageView':
      blocks = [await localImageBlock(roots, item.path) || { type: 'text', text: `[Image: ${path.basename(item.path)}]` }]; break;
    case 'imageGeneration': {
      const image = (item.savedPath ? await localImageBlock(roots, item.savedPath) : null) || inlineImage(item.result);
      blocks = image ? [image] : [{ type: 'text', text: item.status === 'completed' ? 'Image saved on PC.' : `Image generation: ${item.status}` }]; break;
    }
    case 'webSearch': blocks = [{ type: 'tool_use', id: item.id, name: 'Web search', input: { query: item.query, action: item.action, results: item.results } }]; break;
    case 'contextCompaction': blocks = [{ type: 'text', text: 'Conversation context compacted.' }]; role = 'system'; break;
    case 'enteredReviewMode': case 'exitedReviewMode': blocks = [{ type: 'text', text: item.review }]; break;
    default: blocks = [{ type: 'codexItem', content: item }];
  }
  return { id: item.id, role, blocks };
}
