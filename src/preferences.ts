import {validModelId} from '../server/provider-model';
export type WorkspaceProvider = 'claude' | 'codex' | 'copilot';
export type CodexAccess = 'full' | 'ask' | 'auto';
function codexAccess(value:unknown):CodexAccess{return value==='ask'||value==='auto'?value:'full';}
/** The host accepts $0.10–$100 per Claude request; anything else would turn every following message into a 400. */
export const budgetRange={min:0.1,max:100,fallback:5} as const;
export function clampBudget(value:unknown,fallback:number=budgetRange.fallback):number{return typeof value==='number'&&Number.isFinite(value)?Math.round(Math.min(budgetRange.max,Math.max(budgetRange.min,value))*100)/100:fallback;}
/** Parses a typed amount ("0,5", "$5", " 20 "); null when it is not a number at all. */
export function parseBudget(text:string):number|null{const value=Number(text.replace(/[$\s]/g,'').replace(',','.'));return text.trim()&&Number.isFinite(value)?value:null;}
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
export type PreferenceChange={provider:WorkspaceProvider;budget?:number;codexAccess?:CodexAccess};
/** Settings pages outside the chat (desktop settings) change a device default; open chats pick it up through this event. */
export function updatePreferences(change:PreferenceChange){
  const current=preferences(change.provider);savePreferences(change.provider,{...current,...(change.budget!==undefined?{budget:clampBudget(change.budget,current.budget)}:{}),...(change.codexAccess?{codexAccess:codexAccess(change.codexAccess)}:{})});
  if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent<PreferenceChange>('pocket-code-preferences',{detail:change}));
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
