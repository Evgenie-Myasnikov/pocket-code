import { jiraStageAliases, type JiraIssue, type JiraTransition } from './jira.js';
import { HttpError } from './security.js';

export type JiraRole = 'developer' | 'reviewer' | 'qa';
export type WorkflowAction = { id: string; label: string; kind: 'start' | 'transition' | 'pr'; transitions: JiraTransition[] };
export function workflowStage(status: string) {
  const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  const name = normalize(status);
  return Object.entries(jiraStageAliases).find(([, aliases]) => aliases.some(alias => normalize(alias) === name))?.[0] || 'other';
}
export function workflowActions(issue: JiraIssue, role: JiraRole, transitions: JiraTransition[]) {
  const stage = workflowStage(issue.status), actions: WorkflowAction[] = [];
  function action(id: string, label: string, kind: WorkflowAction['kind'], targets?: string[]) {
    const eligible = targets ? transitions.filter(t => targets.includes(workflowStage(t.to.name)) && t.to.name !== issue.status) : [];
    if (!targets || eligible.length) actions.push({ id, label, kind, transitions: eligible });
  }
  if (role === 'developer') {
    if (['backlog', 'open'].includes(stage)) action('start_development', 'Start development', 'start', ['development']);
    if (stage === 'development') {
      action('continue_development', 'Continue development', 'start');
      action('submit_review', 'Send for review', 'pr', ['pr_review', 'review']);
    }
  } else if (role === 'reviewer') {
    if (stage === 'review') action('start_review', 'Start review', 'start', transitions.some(t => workflowStage(t.to.name) === 'pr_review') ? ['pr_review'] : undefined);
    if (stage === 'pr_review') action('start_review', 'Start review', 'start');
    if (['review', 'pr_review'].includes(stage)) {
      action('approve_review', 'Approve review', 'transition', ['waiting_qa']);
      action('request_changes', 'Request changes', 'transition', ['development']);
    }
  } else {
    if (stage === 'waiting_qa') action('start_qa', 'Start QA', 'start', ['qa']);
    if (stage === 'qa') {
      action('start_qa', 'Start QA', 'start');
      action('pass_qa', 'Pass QA', 'transition', ['waiting_merge', 'done']);
      action('fail_qa', 'Return to development', 'transition', ['development']);
    }
  }
  return actions;
}
export function validateTransitionFields(transition: JiraTransition, fields: Record<string, unknown> = {}) {
  for (const key of Object.keys(fields)) if (!Object.hasOwn(transition.fields, key)) throw new HttpError(400, 'This field is not part of the Jira transition. Refresh the task.');
  for (const [key, meta] of Object.entries(transition.fields)) {
    const value = fields[key], empty = value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);
    if (empty) { if (meta.required && !meta.hasDefaultValue) throw new HttpError(400, `Required Jira field: ${meta.name}`); continue; }
    if (meta.allowedValues?.length) {
      const identity = (v: any) => String(v && typeof v === 'object' ? v.id ?? v.accountId ?? v.value ?? v.name : v);
      const values = Array.isArray(value) ? value : [value];
      if (values.some(v => !meta.allowedValues!.some(allowed => identity(allowed) === identity(v)))) throw new HttpError(400, `Invalid Jira field: ${meta.name}`);
    } else if (meta.schema.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new HttpError(400, `Invalid Jira field: ${meta.name}`);
    } else if (['string', 'date', 'datetime'].includes(meta.schema.type)) {
      if (typeof value !== 'string' || value.length > 10000) throw new HttpError(400, `Invalid Jira field: ${meta.name}`);
    } else throw new HttpError(400, `Complete this field in Jira: ${meta.name}`);
  }
}
