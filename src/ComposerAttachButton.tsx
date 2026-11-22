import {useEffect,useId,useLayoutEffect,useRef,useState,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {Folder,LoaderCircle,Paperclip,Plus} from 'lucide-react';
import {useAnchoredPlace} from './anchored-popup';
import {useBackAction} from './navigation';
import {t} from './i18n';
import {ProjectFolderDialog,type ProjectFolderPickerProps} from './ProjectFolderPicker';

export function ComposerAttachButton({disabled,uploading,projectPicker,chooseFiles}:{
  disabled?:boolean; uploading:boolean; projectPicker?:ProjectFolderPickerProps; chooseFiles():void;
}){
  const [open,setOpen]=useState(false),[projectsOpen,setProjectsOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null);
  const id=useId(),available=!disabled,visible=open&&available;
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
      {!disabled&&projectPicker&&<button type="button" disabled={projectPicker.disabled} aria-label={projectPicker.label} aria-haspopup="dialog"
        onClick={()=>{dismiss();setProjectsOpen(true);}}><Folder size={16}/>{projectPicker.label}</button>}
    </div>,document.body)}
    {projectsOpen&&projectPicker&&!disabled&&<ProjectFolderDialog {...projectPicker} onClose={()=>{setProjectsOpen(false);trigger.current?.focus({preventScroll:true});}}/>}
  </div>;
}
