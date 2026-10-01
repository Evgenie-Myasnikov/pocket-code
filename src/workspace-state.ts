import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { WorkspaceProvider } from './preferences';

// Setters and refs keep their original provider even when an async operation
// completes after the user has switched to the other workspace.
export function useWorkspaceState<T>(provider: WorkspaceProvider, initial: T | ((provider: WorkspaceProvider) => T)): [T, Dispatch<SetStateAction<T>>] {
  const [values, setValues] = useState<Record<WorkspaceProvider, T>>(() => {
    const create = (id: WorkspaceProvider) => typeof initial === 'function' ? (initial as (id: WorkspaceProvider) => T)(id) : initial;
    return { claude: create('claude'), codex: create('codex'), copilot:create('copilot') };
  });
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValues(previous => {
      const value=typeof next === 'function' ? (next as (value: T) => T)(previous[provider]) : next;
      return Object.is(value,previous[provider])?previous:{...previous,[provider]:value};
    });
  }, [provider]);
  return [values[provider], setValue];
}
export function useWorkspaceRef<T>(provider: WorkspaceProvider, initial: T) {
  const refs = useRef({ claude: { current: initial }, codex: { current: initial }, copilot:{current:initial} });
  return refs.current[provider];
}
