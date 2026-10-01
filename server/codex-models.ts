export type CodexModel = { id: string; name: string; reasoningEfforts: string[]; defaultReasoningEffort?: string; isDefault: boolean };

// Efforts are advertised strings, not a fixed enum: newer Codex models can
// introduce options without requiring another bridge release.
export const codexEffortPattern = /^[a-z][a-z0-9_-]{0,31}$/;
export function codexModels(data: unknown): CodexModel[] {
  if (!Array.isArray(data)) return [];
  return data.filter(model => model && !model.hidden && typeof model.model === 'string').map(model => {
    const reasoningEfforts: string[] = [...new Set<string>((Array.isArray(model.supportedReasoningEfforts) ? model.supportedReasoningEfforts : [])
      .map((option: any) => option?.reasoningEffort).filter((effort: unknown): effort is string => typeof effort === 'string' && codexEffortPattern.test(effort)))];
    return { id: model.model, name: typeof model.displayName === 'string' ? model.displayName : model.model, reasoningEfforts,
      ...(reasoningEfforts.includes(model.defaultReasoningEffort) ? { defaultReasoningEffort: model.defaultReasoningEffort as string } : {}), isDefault: model.isDefault === true };
  });
}
