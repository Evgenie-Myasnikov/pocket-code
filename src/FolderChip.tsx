import {useRef,useState} from 'react';
import {Folder} from 'lucide-react';
import {ProjectFolderDialog,type ProjectFolderPickerProps} from './ProjectFolderPicker';
import {useLanguage} from './i18n';

/** Above a new chat's message field, as in Strata: the folder the AI will work in, chosen with one click. */
export function FolderChip(props:ProjectFolderPickerProps){
  const ru=useLanguage()==='ru',[open,setOpen]=useState(false),button=useRef<HTMLButtonElement>(null);
  const name=props.value?props.value.split(/[\\/]/).filter(Boolean).at(-1)||props.value:'';
  const label=name||(ru?'Выбрать папку':'Select a folder');
  return <>
    <button ref={button} type="button" className="composer-folder-chip" disabled={props.disabled} title={props.value||label}
      aria-label={(ru?'Папка чата: ':'Chat folder: ')+label} aria-haspopup="dialog" onClick={()=>setOpen(true)}><Folder size={15} aria-hidden="true"/><span>{label}</span></button>
    {open&&<ProjectFolderDialog {...props} onClose={()=>{setOpen(false);button.current?.focus({preventScroll:true});}}/>}
  </>;
}
