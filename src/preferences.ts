import {validModelId} from '../server/provider-model';
export type WorkspaceProvider = 'claude' | 'codex' | 'copilot';
export type CodexAccess = 'full' | 'ask' | 'auto';
function codexAccess(value:unknown):CodexAccess{return value==='ask'||value==='auto'?value:'full';}
const preferenceKey = (provider: WorkspaceProvider) => `pocket-code-chat-preferences-${provider}`;
export function preferences(provider: WorkspaceProvider = 'claude') {
  try {
    const value = JSON.parse(localStorage.getItem(preferenceKey(provider)) || (provider === 'claude' ? localStorage.getItem('pocket-code-chat-preferences') : null) || '{}');
    const validModel = value.model === '' || validModelId(value.model);
    return { model: validModel ? value.model : '', mode: ['default', 'plan'].includes(value.mode) ? value.mode : 'default', budget: typeof value.budget === 'number' && Number.isFinite(value.budget) && value.budget >= 0.1 && value.budget <= 100 ? value.budget : 5, codexAccess:codexAccess(value.codexAccess) };
  } catch { return { model: '', mode: 'default', budget: 5, codexAccess:'full' as CodexAccess }; }
}
export function savePreferences(provider: WorkspaceProvider, value: ReturnType<typeof preferences>) {
  try { localStorage.setItem(preferenceKey(provider), JSON.stringify(value)); } catch { /* Keep in-memory preferences when storage is unavailable. */ }
}
export function preferredRoot(host: string, roots: string[], provider: WorkspaceProvider = 'claude') {
  try {
    const root = JSON.parse(localStorage.getItem(`pocket-code-projects-${provider}`) || '{}')[host]
      || (provider === 'claude' ? JSON.parse(localStorage.getItem('pocket-code-projects') || '{}')[host] : undefined);
    return roots.includes(root) ? root : roots[0] || '';
  } catch { return roots[0] || ''; }
}
export function savePreferredRoot(host: string, root: string, provider: WorkspaceProvider) {
  try { const key = `pocket-code-projects-${provider}`, saved = JSON.parse(localStorage.getItem(key) || '{}'); saved[host] = root; localStorage.setItem(key, JSON.stringify(saved)); } catch { /* Keep the current project for this session. */ }
}
export function selectedWorkspace(): WorkspaceProvider {
  try { const value=localStorage.getItem('pocket-code-workspace');return value==='codex'||value==='copilot'?value:'claude'; } catch { return 'claude'; }
}
export function saveSelectedWorkspace(provider: WorkspaceProvider) {
  try { localStorage.setItem('pocket-code-workspace', provider); } catch { /* Keep the workspace selected for this session. */ }
}
