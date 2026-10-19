import {useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {useModal} from './navigation';
import {t} from './i18n';
import './mobile-navigation.css';

/** The "More" sheet of the phone's bottom bar: secondary sections and the PC connection. */
export function MobileNavigation({open,onClose,children}:{open:boolean;onClose():void;children:ReactNode}){
  const ref=useRef<HTMLElement>(null);useModal(ref,open,onClose);
  if(!open)return null;
  return createPortal(<div className="mobile-menu-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose();}}><section id="mobile-sections" ref={ref} className="mobile-menu-panel" role="dialog" aria-modal="true" aria-label={t('Ещё')}><header><strong>{t('Ещё')}</strong><button className="icon-button" aria-label={t('Закрыть')} onClick={onClose}><X size={24}/></button></header>{children}</section></div>,document.body);
}
