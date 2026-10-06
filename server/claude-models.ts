import {query, type ModelInfo} from '@anthropic-ai/claude-agent-sdk';
import {PromptStream} from './prompt-stream.js';
import {claudeFallbackModels, validModelId, type ProviderModel} from './provider-model.js';
export type ClaudeCatalog = {models: ProviderModel[]; source: 'sdk' | 'fallback'; error?: string};

export function claudeModels(models: ModelInfo[]): ProviderModel[] {
  const result = new Map<string, ProviderModel>();
  for (const model of models) {
    if (!validModelId(model.value)) continue;
    result.set(model.value, {
      id: model.value, name: model.displayName || model.value,
      ...(validModelId(model.resolvedModel) ? {resolvedModel: model.resolvedModel} : {}),
      description: model.description, isDefault: model.value === 'sonnet',
    });
  }
  // A resolved ID pins the version; aliases continue following the provider default.
  for (const model of [...result.values()]) {
    if (model.resolvedModel && !result.has(model.resolvedModel)) {
      result.set(model.resolvedModel, {id: model.resolvedModel, name: model.resolvedModel});
    }
  }
  return [...result.values()];
}

/** Metadata-only initialization: no prompt, tools or model turn is submitted. */
export class ClaudeModelCatalog {
  private cache = new Map<string, {until: number; value: Promise<ClaudeCatalog>}>();
  constructor(private run = query, private timeoutMs = 8000) {}
  read(cwd: string): Promise<ClaudeCatalog> {
    const cached = this.cache.get(cwd);
    if (cached && cached.until > Date.now()) return cached.value;
    if (this.cache.size >= 32) this.cache.delete(this.cache.keys().next().value!);
    const entry = {until: Date.now() + 60_000, value: this.load(cwd)};
    this.cache.set(cwd, entry);
    void entry.value.then(result => {if (result.source === 'fallback') entry.until = Date.now() + 10_000;});
    return entry.value;
  }
  private async load(cwd: string): Promise<ClaudeCatalog> {
    const controller = new AbortController(), prompt = new PromptStream();
    let stream: ReturnType<typeof query> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      stream = this.run({prompt, options: {
        cwd, abortController: controller, settingSources: ['user', 'project', 'local'],
        ...(process.env.CLAUDE_EXECUTABLE ? {pathToClaudeCodeExecutable: process.env.CLAUDE_EXECUTABLE} : {}),
      }});
      const raw = await Promise.race([
        stream.supportedModels(),
        new Promise<never>((_, reject) => {timer = setTimeout(() => reject(new Error('timeout')), this.timeoutMs);}),
      ]);
      const models = claudeModels(raw);
      if (!models.length) throw new Error('Empty catalog');
      return {models, source: 'sdk'};
    } catch {
      // Do not expose SDK initialization diagnostics, paths or account details.
      return {models: claudeFallbackModels, source: 'fallback', error: 'Claude model catalog is unavailable. Aliases and an explicit model ID can still be used.'};
    } finally {
      clearTimeout(timer); prompt.close(); controller.abort();
      try {stream?.close();} catch { /* The process may already have exited. */ }
    }
  }
}
