export type MarkdownChainStatus = 'running' | 'done' | 'failed' | 'stopped';
export type ChainExecutor = {
  provider: 'claude' | 'codex' | 'copilot';
  account?: string;
  model?: string;
};
export type MarkdownChainScope = Pick<ChainExecutor, 'provider' | 'account'> & {cwd:string};
export type ChainDeleteChat=Pick<ChainExecutor,'provider'|'account'>&{sessionId:string};
export type ChainDeletePreview={chats:ChainDeleteChat[];running:ChainDeleteChat[];unavailable:ChainDeleteChat[];unsupported?:ChainDeleteChat[];failed?:ChainDeleteChat[];unknownCount?:number;eraseOriginals?:true};
export type ChainSourceFile = {name:string;projectPath?:string};
export type ChainSourceInput = ChainSourceFile & {text?:string};
export type MarkdownChainStep = {
  executor?: ChainExecutor;
  executorAccountName?: string;
  title: string;
  body: string;
  source: string;
  status: 'pending' | 'running' | 'waiting' | 'done' | 'failed' | 'stopped';
  branch?: string;
  worktreeCwd?: string;
  worktreeSources?: string[];
  uploadPaths?:Record<string,string>;
  launchCwd?: string;
  baseCommit?: string;
  headCommit?: string;
  retryCount?: number;
  retryAt?: number;
  retryReport?: string;
  previousChats?: (ChainDeleteChat & {cwd:string;attempt:number})[];
  jobId?: string;
  sessionId?: string;
  /** Paused while the local model is swapped for a scheduled run: the step continues in its session when the model is back. */
  paused?: 'local-model';
  /** The job that continues the paused step. */
  resumeJobId?: string;
  error?: string;
  handoff?: string;
  /** Latest visible assistant text, with streaming deltas while the job runs. */
  output?: string;
  outputTruncated?: boolean;
  subtasks?: {id:string;name:string;status:'running'|'completed'|'error'|'stopped'|'unknown'}[];
  phase?: 'responding' | 'command' | 'files' | 'search' | 'agent' | 'tool' | 'approval' | 'question';
};
export const CHAIN_LOOP_MAX_LAPS = 20;
export const CHAIN_LOOP_RETRIES = 3;
/** A chain whose last step leads back to the first one. It always ends: by its condition, by the lap limit or by an idle lap. */
export type ChainLoop = {
  maxLaps: number;
  /** What the last step checks to end the loop before the limit. */
  until?: string;
  /** End the loop after a lap that committed nothing (chains that run in Git worktrees). */
  stopIdle?: boolean;
  lap: number;
  ended?: 'condition' | 'limit' | 'idle';
  /** Result of the previous lap, handed to the first step of the next one. */
  carry?: string;
  baseCommit?: string;
  headCommit?: string;
};
export type MarkdownChainDetail = {
  loop?: ChainLoop;
  id: string;
  cwd: string;
  provider: ChainExecutor['provider'];
  account?: string;
  accountName?: string;
  parallelSubtasks?: boolean;
  sourceFiles?: ChainSourceFile[];
  /** Model requested when the chain was created, including provider aliases. */
  model?: string;
  name: string;
  context: string;
  status: MarkdownChainStatus;
  steps: MarkdownChainStep[];
};
export type MarkdownChainSummary = Pick<MarkdownChainDetail, 'id' | 'name' | 'status'> & {
  stepsDone: number;
  stepCount: number;
  loop?: Pick<ChainLoop, 'lap' | 'maxLaps' | 'ended'>;
};

export function chainCompletionMarker(id: string, index: number) {
  return `[STEP_COMPLETE ${id}/${index + 1}]`;
}
export function chainLoopMarker(id: string) {
  return `[LOOP_FINISHED ${id}]`;
}
/** Splits the loop decision of the last step from its report. */
export function readLoopDecision(text: string, id: string) {
  const marker = chainLoopMarker(id), trimmed = text.trimEnd();
  if (trimmed.split(/\r?\n/).at(-1)?.trim() !== marker) return {text, finished: false};
  return {text: trimmed.slice(0, trimmed.lastIndexOf(marker)).trimEnd(), finished: true};
}

function joinSourcePath(folder:string,relative:string) {
  const separator=folder.includes('\\')?'\\':'/';
  return folder.replace(/[\\/]+$/,'')+separator+relative.replace(/[\\/]/g,separator);
}

export function sourceFileLocations(chain:MarkdownChainDetail,step:MarkdownChainStep) {
  return (chain.sourceFiles??[]).map(file=>({
    name:file.name,
    projectPath:file.projectPath?joinSourcePath(chain.cwd,file.projectPath):undefined,
    worktreePath:file.projectPath && step.launchCwd && step.worktreeSources?.includes(file.projectPath)
      ?joinSourcePath(step.launchCwd,file.projectPath):undefined,
    uploadPath:step.uploadPaths && Object.hasOwn(step.uploadPaths,file.name)?step.uploadPaths[file.name]:undefined
  }));
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
  const loop = chain.loop;
  if (loop) sections.push(
    `This chain repeats its steps in laps. This is lap ${loop.lap} of at most ${loop.maxLaps}. Continue from the state the previous laps left; do not redo finished work.`
  );
  if (index > 0 && chain.steps[index - 1].handoff) {
    sections.push(`Previous step: ${chain.steps[index - 1].title}\n${chain.steps[index - 1].handoff}`);
  }
  if (index === 0 && loop?.carry) sections.push(`Result of the previous lap (${chain.steps.at(-1)!.title})\n${loop.carry}`);
  if(chain.sourceFiles?.length){
    const files=sourceFileLocations(chain,step);
    sections.push('Selected source files for this step (project originals are reference material; make edits in the assigned working directory):\n'+
      files.map(file=>[file.name,file.projectPath && 'project: '+file.projectPath,file.worktreePath && 'working copy: '+file.worktreePath,
        file.uploadPath && 'uploaded copy: '+file.uploadPath].filter(Boolean).join(' | ')).join('\n'));
  }
  if (chain.parallelSubtasks === true) sections.push(
    'During this step, use your native subagent tools when there are independent tasks that can run in parallel. Give each subagent a concrete deliverable, relevant context and a non-overlapping scope. Keep dependent work sequential. Stay within the current step, worktree, permissions and budget. Wait for your subagents, reconcile their results and verify the combined work before reporting completion. If delegation tools are unavailable, do the work yourself.'
  );
  if (chain.parallelSubtasks === false) sections.push('Complete this step yourself without delegating work to subagents.');
  if (step.launchCwd) sections.push(
    'Selected project folder: '+JSON.stringify(chain.cwd)+
    (step.worktreeCwd && step.worktreeCwd!==step.launchCwd?'\nGit worktree root: '+JSON.stringify(step.worktreeCwd):'')+
    '\nWorking directory for this step: '+JSON.stringify(step.launchCwd)+
    '\nRun commands with this explicit working directory and resolve relative paths from it. If a tool defaults to a different folder, set its workdir before inspecting or editing files.'
  );
  if (step.branch) sections.push('Work in the assigned Git worktree on '+step.branch+'. Commit only the intended step changes before confirming completion. Leave integration and merging to the user.');
  if (step.retryCount) sections.push(
    `Continue the unfinished step. Inspect existing changes and rerun outstanding checks. Avoid repeating completed work. Previous attempt report:\n${step.retryReport || "(no report)"}`
  );
  sections.push(`Current task (${step.source})\n${step.body}`);
  if (loop && index === chain.steps.length - 1 && loop.lap < loop.maxLaps) sections.push(
    'Loop decision. After finishing this step, decide whether another lap is needed. ' +
    (loop.until ? `The loop must stop when this holds: ${loop.until}` : 'The loop must stop when another lap would not improve the result.') +
    `\nIf the loop must stop, put this exact line immediately before the completion line:\n${chainLoopMarker(chain.id)}\nOtherwise omit it and the host starts the next lap from the first step.`
  );
  sections.push(
    `After completing and verifying this step, summarize the result and checks for the next chat, then end your reply with this exact line:\n${chainCompletionMarker(chain.id, index)}\nIf blocked, describe what is needed and omit the completion line.`
  );
  return sections.join('\n\n');
}
