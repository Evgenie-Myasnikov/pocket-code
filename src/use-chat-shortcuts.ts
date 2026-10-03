import {useEffect} from 'react';
// Preserve native editing/clipboard behavior inside fields. Outside fields,
// select only this conversation and direct paste to its composer.
export function useChatShortcuts(enabled:boolean){
 useEffect(()=>{if(!enabled)return;const key=(e:KeyboardEvent)=>{
  if(!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey||document.querySelector('dialog[open],[aria-modal="true"]'))return;
  const target=e.target as HTMLElement;if(target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const chat=document.querySelector<HTMLElement>('.desktop-chat-host .app');if(!chat||!chat.getClientRects().length)return;
  if(e.code==='KeyA'){const content=chat.querySelector('.conversation-inner');if(content&&content.getClientRects().length){e.preventDefault();const range=document.createRange();range.selectNodeContents(content);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);}}
  if(e.code==='KeyV'){const composer=chat.querySelector<HTMLTextAreaElement>('.composer textarea:not(:disabled)');composer?.focus();}
 };document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[enabled]);
}
