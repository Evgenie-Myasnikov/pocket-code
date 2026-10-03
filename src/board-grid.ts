import {useSyncExternalStore} from 'react';

export const boardGridSteps=[8,12,16,24,32,64] as const;
const key='pocket-board-grid-step',event='pocket-board-grid-changed';
export function validGridStep(value:number){return boardGridSteps.includes(value as typeof boardGridSteps[number])?value:8;}
function read(){try{return validGridStep(Number(localStorage.getItem(key)));}catch{return 8;}}
function subscribe(listener:()=>void){window.addEventListener(event,listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener(event,listener);window.removeEventListener('storage',listener);};}
export function useBoardGrid(){return useSyncExternalStore(subscribe,read,()=>8);}
export function setBoardGrid(value:number){localStorage.setItem(key,String(validGridStep(value)));window.dispatchEvent(new Event(event));}
