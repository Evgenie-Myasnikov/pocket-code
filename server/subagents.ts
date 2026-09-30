import { getSessionMessages, getSubagentMessages, listSubagents } from '@anthropic-ai/claude-agent-sdk';
import { HttpError } from './security.js';
import { normalize, type ChatMessage, type SubagentView } from './types.js';

export type { SubagentView } from './types.js';
export type SubagentReader = { getSessionMessages: typeof getSessionMessages; getSubagentMessages: typeof getSubagentMessages; listSubagents: typeof listSubagents };
const sdk: SubagentReader = { getSessionMessages, getSubagentMessages, listSubagents };
export const validAgentId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
const text = (value: unknown) => typeof value === 'string' ? value : undefined;
function checkId(id: string) { if (!validAgentId(id)) throw new HttpError(400, 'Invalid agent identifier.'); }
function messageText(message: any): string | undefined {
  const content = message?.message?.content;
  return typeof content === 'string' ? content : Array.isArray(content) ? content.filter(b => b?.type === 'text').map(b => b.text).join('\n') || undefined : undefined;
}
async function children(parent: string, cwd: string, reader: SubagentReader) {
  checkId(parent);
  if (!cwd) throw new HttpError(400, 'The parent project is required.');
  const ids = [...new Set((await reader.listSubagents(parent, { dir: cwd })).filter(validAgentId))];
  if (ids.length > 100) throw new HttpError(413, 'Too many agents to load at once.');
  return ids;
}

/** Caller first authorizes the parent and its project; the SDK lookup stays in that project. */
export async function claudeSubagents(parent: string, cwd: string, reader = sdk): Promise<SubagentView[]> {
  const ids = await children(parent, cwd, reader), agents: SubagentView[] = [];
  if (!ids.length) return agents;
  const parentMessages = await reader.getSessionMessages(parent, { dir: cwd, limit: 5001 });
  if (parentMessages.length > 5000) throw new HttpError(413, 'This conversation is too large to resolve its agents.');
  const cards: ChatMessage[] = [];
  for (const event of parentMessages) {
    const message = normalize(event); if (message) cards.push(message);
    updateClaudeAgents(cards, event); updateClaudeAgentResults(cards, event);
  }
  const known = cards.flatMap(m => m.blocks).filter(b => b.agent).map(b => b.agent!);
  for (const id of ids) {
    const first = await reader.getSubagentMessages(parent, id, { dir: cwd, limit: 1 });
    const prompt = messageText(first[0]);
    agents.push({ id, sessionId: id, name: prompt?.split('\n')[0].slice(0, 120) || 'Claude agent', provider: 'claude', status: 'unknown', prompt });
  }
  for (const agent of agents) {
    const matching = known.filter(a => a.id === agent.id || (a.prompt && a.prompt === agent.prompt));
    if (matching.length !== 1 || (matching[0].id !== agent.id && agents.filter(a => a.prompt === agent.prompt).length !== 1)) continue;
    const match = matching[0];
    agent.name = match.name; agent.result = match.result;
    // Stored starts cannot prove current activity after a bridge/CLI restart.
    agent.status = match.status === 'running' ? 'unknown' : match.status;
  }
  return agents;
}

export async function claudeSubagentMessages(parent: string, agentId: string, cwd: string, reader = sdk): Promise<ChatMessage[]> {
  checkId(agentId);
  const ids = await children(parent, cwd, reader);
  let child = ids.includes(agentId) ? agentId : undefined;
  // Saved Agent tool calls carry tool-use IDs, not necessarily the transcript's agent ID.
  // Resolve only an exact, unique prompt match among this parent's SDK-listed children.
  if (!child) {
    const parentMessages = await reader.getSessionMessages(parent, { dir: cwd, limit: 5001 });
    if (parentMessages.length > 5000) throw new HttpError(413, 'This conversation is too large to resolve an agent.');
    const call = parentMessages.flatMap((m: any) => Array.isArray(m.message?.content) ? m.message.content : [])
      .find((b: any) => b.type === 'tool_use' && b.id === agentId && ['Agent', 'Task'].includes(b.name));
    if (typeof call?.input?.prompt === 'string') {
      const matches: string[] = [];
      for (const id of ids) {
        const first = await reader.getSubagentMessages(parent, id, { dir: cwd, limit: 1 });
        if (messageText(first[0]) === call.input.prompt) matches.push(id);
      }
      if (matches.length === 1) child = matches[0];
    }
  }
  if (!child) throw new HttpError(404, 'Agent transcript is not available for this conversation.');
  const raw = await reader.getSubagentMessages(parent, child, { dir: cwd, limit: 5001 });
  if (raw.length > 5000 || JSON.stringify(raw).length > 16_000_000) throw new HttpError(413, 'This agent transcript is too large to load on the phone.');
  return raw.map(message => normalize({ ...message, parent_tool_use_id: null })).filter((m): m is ChatMessage => Boolean(m));
}

export function codexAgents(item: any, live = false): SubagentView[] {
  if (item?.type === 'subAgentActivity' && validAgentId(item.agentThreadId)) return [{
    id: item.agentThreadId, sessionId: item.agentThreadId, name: text(item.agentPath) || 'Codex agent', provider: 'codex',
    status: item.kind === 'completed' ? 'completed' : item.kind === 'interrupted' ? 'stopped' : live && item.kind === 'started' ? 'running' : 'unknown',
  }];
  if (item?.type !== 'collabAgentToolCall') return [];
  const ids: string[] = [...new Set<string>((Array.isArray(item.receiverThreadIds) ? item.receiverThreadIds : []).filter(validAgentId))];
  return ids.map(id => {
    const state = item.agentsStates?.[id];
    const status: SubagentView['status'] = state?.status === 'completed' ? 'completed' : state?.status === 'errored' ? 'error'
      : ['interrupted', 'shutdown'].includes(state?.status) ? 'stopped' : live && ['running', 'pendingInit'].includes(state?.status) ? 'running' : 'unknown';
    return { id, sessionId: id, name: 'Codex agent', status, provider: 'codex', prompt: text(item.prompt), result: text(state?.message) };
  });
}

/** Applies SDK lifecycle evidence to the one visible card; unrelated background tools are ignored. */
export function updateClaudeAgents(messages: ChatMessage[], event: any) {
  const cards = messages.flatMap(m => m.blocks).filter(b => b.type === 'subagent' && b.agent?.provider === 'claude');
  const parentId = event.tool_use_id || event.parent_tool_use_id;
  let card = cards.find(b => b.id === parentId || b.agent?.id === event.task_id);
  if (!card && event.type === 'system' && event.subtype === 'task_started' && event.task_type === 'local_agent' && validAgentId(event.task_id) && !event.ambient && !event.skip_transcript && (event.spawn_depth ?? 1) === 1) {
    card = { type: 'subagent', id: event.tool_use_id || event.task_id, agent: { id: event.task_id, name: text(event.description) || 'Claude agent', provider: 'claude', status: 'running', prompt: text(event.prompt) } };
    messages.push({ id: `agent-${event.task_id}`, role: 'assistant', blocks: [card] });
  }
  if (!card?.agent) return;
  const agent = card.agent;
  if (event.subtype === 'task_started' || event.subtype === 'task_progress') {
    if (validAgentId(event.task_id)) { agent.id = event.task_id; agent.sessionId = event.task_id; }
    agent.status = 'running'; agent.name = text(event.description) || agent.name;
    agent.prompt = text(event.prompt) || agent.prompt;
  }
  if (event.subtype === 'task_notification') {
    agent.status = event.status === 'completed' ? 'completed' : event.status === 'failed' ? 'error' : event.status === 'stopped' ? 'stopped' : 'unknown';
    agent.result = text(event.summary);
  }
  if (event.subtype === 'task_updated') {
    const status = event.patch?.status;
    if (status) agent.status = status === 'completed' ? 'completed' : status === 'failed' ? 'error' : status === 'killed' ? 'stopped' : status === 'running' ? 'running' : 'unknown';
  }
}

export function updateClaudeAgentResults(messages: ChatMessage[], event: any) {
  const output = event.tool_use_result;
  for (const result of Array.isArray(event.message?.content) ? event.message.content : []) {
    if (result?.type !== 'tool_result') continue;
    const card = messages.flatMap(m => m.blocks).find(b => b.type === 'subagent' && b.id === result.tool_use_id);
    if (!card?.agent) continue;
    if (result.is_error) { card.agent.status = 'error'; continue; }
    if (!output || !validAgentId(output.agentId)) continue;
    card.agent.id = output.agentId; card.agent.sessionId = output.agentId;
    card.agent.status = output.status === 'completed' ? 'completed' : output.status === 'async_launched' ? 'running' : 'unknown';
    card.agent.result = Array.isArray(output.content) ? output.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') : undefined;
  }
}
