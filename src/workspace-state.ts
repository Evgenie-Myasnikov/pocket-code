import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { WorkspaceProvider } from './preferences';

// Setters and refs keep their original provider even when an async operation
// completes after the user has switched to the other workspace.
export function useWorkspaceState<T>(provider: WorkspaceProvider, initial: T | ((provider: WorkspaceProvider) => T), connectionScope=''): [T, Dispatch<SetStateAction<T>>] {
  const key=connectionScope+':'+provider;
  const defaults=useRef(new Map<string,T>());
  if(!defaults.current.has(key))defaults.current.set(key,typeof initial==='function'?(initial as (id:WorkspaceProvider)=>T)(provider):initial);
  const [values,setValues]=useState<Record<string,T>>({});
  const fallback=defaults.current.get(key)!;
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValues(previous => {
      const before=Object.hasOwn(previous,key)?previous[key]:fallback;
      const value=typeof next === 'function' ? (next as (value: T) => T)(before) : next;
      return Object.is(value,before)?previous:{...previous,[key]:value};
    });
  }, [key,fallback]);
  return [Object.hasOwn(values,key)?values[key]:fallback,setValue];
}
export function useWorkspaceRef<T>(provider: WorkspaceProvider, initial: T, connectionScope='') {
  const refs=useRef(new Map<string,{current:T}>()),key=connectionScope+':'+provider;
  if(!refs.current.has(key))refs.current.set(key,{current:initial});
  return refs.current.get(key)!;
}
