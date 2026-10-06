/** Model identifiers are data, never a shell command. Allow provider-qualified IDs. */
export const modelIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:/@+\[\]-]{0,199}$/;
export function validModelId(value: unknown): value is string {
  return typeof value === 'string' && modelIdPattern.test(value);
}
export type ProviderModel = {
  id: string;
  name: string;
  resolvedModel?: string;
  description?: string;
  isDefault?: boolean;
  reasoningEfforts?: string[];
  defaultReasoningEffort?: string;
};
export const claudeFallbackModels: ProviderModel[] = [
  {id: 'sonnet', name: 'Sonnet', isDefault: true},
  {id: 'opus', name: 'Opus'},
  {id: 'haiku', name: 'Haiku'},
];
