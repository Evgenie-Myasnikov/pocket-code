import {useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Menu,X} from 'lucide-react';
import {useModal} from './navigation';
import {locale} from './i18n';
import './mobile-navigation.css';

export function MobileMenuButton({open,onOpen,status}:{open:boolean;onOpen():void;status?:ReactNode}){
  const label=locale().startsWith('ru')?'Меню разделов':'Navigation menu';
  return <button className="icon-button mobile-menu-button" aria-label={label} aria-expanded={open} aria-controls="mobile-sections" onClick={onOpen}><Menu size={23}/>{status}</button>;
}
export function MobileNavigation({open,onClose,children}:{open:boolean;onClose():void;children:ReactNode}){
  const ref=useRef<HTMLElement>(null);useModal(ref,open,onClose);
  if(!open)return null;
  const ru=locale().startsWith('ru');
  return createPortal(<div className="mobile-menu-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose();}}><section id="mobile-sections" ref={ref} className="mobile-menu-panel" role="dialog" aria-modal="true" aria-label={ru?'Разделы приложения':'App sections'}><header><strong>{ru?'Разделы':'Sections'}</strong><button className="icon-button" aria-label={ru?'Закрыть меню':'Close menu'} onClick={onClose}><X size={22}/></button></header>{children}</section></div>,document.body);
}
