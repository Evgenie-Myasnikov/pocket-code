import {useEffect,useId,useLayoutEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {GitBranch,ListOrdered,LoaderCircle,Paperclip,Plus} from 'lucide-react';
import {useAnchoredPlace} from './anchored-popup';
import {useBackAction} from './navigation';
import {t} from './i18n';
import type {ImproveScope} from './ImproveTaskText';
import {MarkdownTaskDialog} from './MarkdownTaskDialog';
import {MarkdownChainPanel,type MarkdownChainControls} from './MarkdownChainPanel';
import type {MarkdownChainDetail} from './markdown-chain';
import {useLanguage} from './i18n';

export function ComposerAttachButton({scopeKey,disabled,uploading,projectPicker,chooseFiles,maxBatchLength,onPrepareBatch,chainControls,improveScope}:{
  scopeKey?:string;
  disabled?:boolean; uploading:boolean; projectPicker?:ReactNode; chooseFiles():void;
  maxBatchLength:number; onPrepareBatch(value:string):void;
  chainControls?:MarkdownChainControls; improveScope?:ImproveScope;
}){
  const [open,setOpen]=useState(false);
  const [tasksOpen,setTasksOpen]=useState(false);
  const [chainPanel,setChainPanel]=useState<{initial?:MarkdownChainDetail}|null>(null);
  useLayoutEffect(()=>{setTasksOpen(false);setChainPanel(null);},[scopeKey]);
  const ru=useLanguage()==='ru';
  const trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null);
  const id=useId(),available=!disabled||!!chainControls,visible=open&&available;
  const place=useAnchoredPlace(visible,trigger,300);
  const label=t('Прикрепить файлы');
  function dismiss(){
    setOpen(false);
    trigger.current?.focus({preventScroll:true});
  }
  useBackAction(()=>{dismiss();return true;},110,visible);
  useLayoutEffect(()=>{
    if(visible)popup.current?.querySelector<HTMLButtonElement>('button:enabled')?.focus({preventScroll:true});
    else setOpen(false);
  },[visible]);
  useEffect(()=>{
    if(!visible)return;
    function outside(event:Event){
      const target=event.target as Node;
      if(!trigger.current?.contains(target)&&!popup.current?.contains(target))setOpen(false);
    }
    document.addEventListener('pointerdown',outside);
    document.addEventListener('focusin',outside);
    return ()=>{
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('focusin',outside);
    };
  },[visible]);
  function navigate(event:KeyboardEvent<HTMLDivElement>){
    if(event.key==='Escape'){
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    }else if(event.key==='Tab'){
      const controls=event.currentTarget.querySelectorAll<HTMLElement>('button:enabled,select:enabled');
      if(event.shiftKey&&event.target===controls[0]){
        event.preventDefault();
        dismiss();
      }else if(!event.shiftKey&&event.target===controls[controls.length-1]){
        // Leave the portal mounted until Tab moves focus from the trigger to the next control.
        trigger.current?.focus({preventScroll:true});
      }
    }
  }
  return <div className="composer-add">
    <button ref={trigger} type="button" className="icon-button composer-attach" aria-label={label}
      aria-expanded={visible} aria-controls={visible?id:undefined}
      disabled={!available} onClick={()=>setOpen(value=>!value)}>
      {uploading?<LoaderCircle size={20} className="composer-uploading"/>:<Plus size={20}/>}
    </button>
    {visible&&createPortal(<div id={id} ref={popup} className="composer-add-menu" style={place}
      role="group" aria-label={label} onKeyDown={navigate}>
      <button type="button" disabled={disabled} onClick={()=>{dismiss();chooseFiles();}}><Paperclip size={16}/>{label}</button>
      {!disabled&&projectPicker&&<div onChange={dismiss}>{projectPicker}</div>}
      <button type="button" disabled={disabled} onClick={()=>{dismiss();setTasksOpen(true);}}><ListOrdered size={16}/>{t('Задачи из Markdown')}</button>
      {chainControls&&<button type="button" onClick={()=>{dismiss();setChainPanel({});}}><GitBranch size={16}/>{ru?'Цепочки задач':'Task chains'}</button>}
    </div>,document.body)}
    {tasksOpen&&!disabled&&<MarkdownTaskDialog improveScope={improveScope} maxLength={maxBatchLength}
      controls={chainControls} onStarted={chain=>{setTasksOpen(false);setChainPanel({initial:chain});}}
      onClose={()=>{setTasksOpen(false);trigger.current?.focus({preventScroll:true});}}
      onPrepare={value=>{onPrepareBatch(value);setTasksOpen(false);}}/>}
    {chainPanel&&chainControls&&<MarkdownChainPanel controls={chainControls} initial={chainPanel.initial}
      onClose={()=>{setChainPanel(null);trigger.current?.focus({preventScroll:true});}}/>}
  </div>;
}
