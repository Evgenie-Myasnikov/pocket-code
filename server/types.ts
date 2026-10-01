export type SubagentView = { id: string; name: string; status: 'running' | 'completed' | 'error' | 'stopped' | 'unknown'; prompt?: string; result?: string; sessionId?: string; provider: 'claude' | 'codex' };
export type Block = { type: string; agent?: SubagentView; text?: string; name?: string; input?: unknown; content?: unknown; id?: string; tool_use_id?: string; thinking?: string; is_error?: boolean; title?: string; source?: { type?: string; media_type?: string; data?: string; url?: string; text?: string }; data?: string; mimeType?: string };
export type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system'; blocks: Block[] };
export type Approval = { id: string; tool: string; input: Record<string, unknown>; expiresAt: number };
export type ActivityItem = {
  id: string; provider: 'claude' | 'codex'; cwd: string; sessionId?: string; title: string;
  status: 'running' | 'needs_input' | 'done' | 'error' | 'stopped'; startedAt: number; version: string;
  /** For completed jobs only: the latest assistant message that must actually be viewed before acknowledging from history. */
  resultMessageId?: string;
  action?: 'command' | 'files' | 'search' | 'agent' | 'responding' | 'tool';
};
export type JobView = {
  provider?: 'claude' | 'codex';
  id: string; cwd: string; sessionId?: string; status: 'running' | 'done' | 'error' | 'stopped';
  messages: ChatMessage[]; partial: string; approvals: Approval[]; error?: string;
  errorCode?: 'codex_thread_busy';
  cost?: number; startedAt: number; revision: number; baseMessageCount: number;
  jira?: { site: string; key: string; summary: string; url: string };
};
export function normalize(message: any): ChatMessage | null {
  // Nested SDK events belong to their own transcript, never the parent's.
  if (message.parent_tool_use_id) return null;
  if (!['user', 'assistant', 'system'].includes(message.type)) return null;
  const body = message.message;
  const content = body?.content;
  if (!content) return null;
  const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
  if (!Array.isArray(blocks)) return null;
  return { id: message.uuid || crypto.randomUUID(), role: message.type, blocks: blocks.map((block: Block) => {
    if (block.type !== 'tool_use' || !['Agent', 'Task'].includes(block.name || '') || !block.id) return block;
    const input = block.input as Record<string, unknown> | undefined;
    return { type: 'subagent', id: block.id, agent: {
      id: typeof input?.resume === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(input.resume) ? input.resume : block.id,
      name: typeof input?.description === 'string' ? input.description.slice(0, 200) : typeof input?.subagent_type === 'string' ? input.subagent_type : 'Claude agent',
      prompt: typeof input?.prompt === 'string' ? input.prompt : undefined, status: 'unknown', provider: 'claude',
    } } as Block;
  }) };
}
