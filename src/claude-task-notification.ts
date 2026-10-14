export type ClaudeTaskNotification = {
  status: 'running' | 'completed' | 'failed' | 'stopped' | 'unknown';
  taskCount: number;
  summary: string;
  note?: string;
};

const decodeXmlText = (value: string) => value
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&')
  .trim();

function field(xml: string, name: string) {
  const match = new RegExp(`<${name}\\s*>([\\s\\S]*?)<\\/${name}\\s*>`, 'i').exec(xml);
  return match ? decodeXmlText(match[1]) : '';
}

/** Recognizes Claude Code's standalone background-task notification envelope. */
export function parseClaudeTaskNotification(value: string): ClaudeTaskNotification | undefined {
  const envelope = /^\s*<task-notification\s*>([\s\S]*?)<\/task-notification\s*>\s*$/i.exec(value);
  if (!envelope) return undefined;
  const body = envelope[1];
  const taskIds = [...body.matchAll(/<task-id\s*>([\s\S]*?)<\/task-id\s*>/gi)]
    .map(match => decodeXmlText(match[1]))
    // These are transport sentinels, not user tasks or task identifiers.
    .filter(id => /^[a-zA-Z0-9_-]{1,128}$/.test(id) && !id.startsWith('__'));
  const rawStatus = field(body, 'status').toLowerCase();
  const status: ClaudeTaskNotification['status'] = ['running', 'completed', 'failed', 'stopped'].includes(rawStatus)
    ? rawStatus as ClaudeTaskNotification['status'] : 'unknown';
  const readable = (text: string) => text.replace(/\s*task\s+ids?\s*:\s*[^\r\n]*$/i, '').replace(/\s*Task ids in this notification[\s\S]*$/i, '').trim();
  const summary = readable(field(body, 'summary'));
  if (!summary) return undefined;
  return { status, taskCount: new Set(taskIds).size, summary, note: readable(field(body, 'note')) || undefined };
}

export function isClaudeTaskNotificationPrefix(value: string) {
  return /^\s*<task-notification(?:\s|>)/i.test(value) && !/<\/task-notification\s*>\s*$/i.test(value);
}
