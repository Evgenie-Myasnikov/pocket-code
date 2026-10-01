import { createHash } from 'node:crypto';
import path from 'node:path';
import type { ActivityItem, JobView } from './types.js';
export type { ActivityItem } from './types.js';

export function recentActivityJobs(jobs: JobView[]): JobView[] {
  const newestFirst = (a: JobView, b: JobView) => b.startedAt - a.startedAt || a.id.localeCompare(b.id);
  const latest = new Map<string, JobView>();
  for (const job of [...jobs].sort(newestFirst)) {
    const key = JSON.stringify([job.provider || 'claude', job.sessionId ? 'session' : 'job', job.sessionId || job.id]);
    if (!latest.has(key)) latest.set(key, job);
  }
  // Keep an older active chat visible even when many newer chats have finished.
  return [...latest.values()].sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running') || newestFirst(a, b)).slice(0, 100).sort(newestFirst);
}

export function activityItem(job: JobView): ActivityItem {
  const approvalIds = job.status === 'running' ? job.approvals.map(approval => approval.id).sort() : [];
  const status = approvalIds.length ? 'needs_input' : job.status;
  const userText = job.messages.find(message => message.role === 'user')?.blocks.find(block => block.type === 'text' && block.text?.trim())?.text;
  const title = (job.jira ? `${job.jira.key} ${job.jira.summary}` : userText || path.basename(job.cwd) || 'Chat').replace(/\s+/g, ' ').trim().slice(0, 160);
  // Streaming, titles and late session IDs must not resurrect an acknowledged
  // state. A new question or a terminal outcome does need fresh attention.
  const version = createHash('sha256').update(JSON.stringify([job.id, status, approvalIds])).digest('base64url').slice(0, 24);
  const resultMessageId = status === 'done' ? [...job.messages].reverse().find(message => message.role === 'assistant')?.id : undefined;
  return { id: job.id, provider: job.provider || 'claude', cwd: job.cwd, ...(job.sessionId ? { sessionId: job.sessionId } : {}), title,
    status, startedAt: job.startedAt, version, ...(resultMessageId ? { resultMessageId } : {}) };
}
