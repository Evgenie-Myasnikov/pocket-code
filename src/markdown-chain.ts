export type MarkdownChainStatus = 'running' | 'done' | 'failed' | 'stopped';
export type MarkdownChainStep = {
  title: string;
  body: string;
  source: string;
  status: 'pending' | 'running' | 'waiting' | 'done' | 'failed' | 'stopped';
  jobId?: string;
  sessionId?: string;
  error?: string;
  handoff?: string;
};
export type MarkdownChainDetail = {
  id: string;
  cwd: string;
  provider: 'claude' | 'codex' | 'copilot';
  account?: string;
  name: string;
  context: string;
  status: MarkdownChainStatus;
  steps: MarkdownChainStep[];
};
export type MarkdownChainSummary = Pick<MarkdownChainDetail, 'id' | 'name' | 'status'> & {
  stepsDone: number;
  stepCount: number;
};

export function chainCompletionMarker(id: string, index: number) {
  return `[STEP_COMPLETE ${id}/${index + 1}]`;
}

// Keep the prompt format stable: the tracker reconstructs each chat's input
// from its immutable sources and the previous step's saved handoff.
export function buildChainStepPrompt(chain: MarkdownChainDetail, index: number) {
  const step = chain.steps[index];
  const sections = [
    `Work on step ${index + 1} of ${chain.steps.length}: ${step.title}`,
    'The host runs each step in a separate chat in this project. Use the shared context for this step only. Leave the remaining steps to the host.',
    `Shared context (${chain.name})\n${chain.context}`
  ];
  if (index > 0 && chain.steps[index - 1].handoff) {
    sections.push(`Previous step: ${chain.steps[index - 1].title}\n${chain.steps[index - 1].handoff}`);
  }
  sections.push(
    `Current task (${step.source})\n${step.body}`,
    `After completing and verifying this step, summarize the result and checks for the next chat, then end your reply with this exact line:\n${chainCompletionMarker(chain.id, index)}\nIf blocked, describe what is needed and omit the completion line.`
  );
  return sections.join('\n\n');
}
