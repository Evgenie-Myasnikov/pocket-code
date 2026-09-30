export type Block = { type: string; text?: string; name?: string; input?: unknown; content?: unknown; id?: string; tool_use_id?: string; thinking?: string; is_error?: boolean; title?: string; source?: { type?: string; media_type?: string; data?: string; url?: string; text?: string }; data?: string; mimeType?: string };
export type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system'; blocks: Block[] };
export type Approval = { id: string; tool: string; input: Record<string, unknown>; expiresAt: number };
export type JobView = {
  provider?: 'claude' | 'codex';
  id: string; cwd: string; sessionId?: string; status: 'running' | 'done' | 'error' | 'stopped';
  messages: ChatMessage[]; partial: string; approvals: Approval[]; error?: string;
  cost?: number; startedAt: number; revision: number; baseMessageCount: number;
  jira?: { site: string; key: string; summary: string; url: string };
};
export function normalize(message: any): ChatMessage | null {
  if (!['user', 'assistant', 'system'].includes(message.type)) return null;
  const body = message.message;
  const content = body?.content;
  if (!content) return null;
  const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
  if (!Array.isArray(blocks)) return null;
  return { id: message.uuid || crypto.randomUUID(), role: message.type, blocks };
}
