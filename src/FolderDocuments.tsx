import {lazy,Suspense,useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import type {Connection} from './api';
import {t} from './i18n';
import './project-docs.css';

const ProjectDocs=lazy(()=>import('./ProjectDocs').then(module=>({default:module.ProjectDocs})));
const folderName=(root:string)=>root.split(/[\\/]/).filter(Boolean).at(-1)||root;

/** Rules or the changelog of the folder an open chat works in, opened from the chat header. */
export function FolderDocuments({connection,root,kind,onBack,onChat}:{connection:Connection;root:string;kind:'rules'|'changelog';onBack():void;onChat?(root:string,prompt:string):void}){
  const [reading,setReading]=useState('');
  const title=kind==='rules'?t('Правила'):t('История изменений');
  return <section className={'document-library folder-documents'+(reading?' reading':'')} aria-label={title}>
    <header className="document-section-heading folder-documents-heading">
      <button className="icon-button" aria-label={t('Назад к чату')} title={t('Назад к чату')} onClick={onBack}><ArrowLeft size={18}/></button>
      <h1>{title}</h1><span className="muted" title={root}>{folderName(root)}</span>
    </header>
    <Suspense fallback={<div className="loading-skeleton" role="status"><span/><span/></div>}>
      <ProjectDocs key={kind+root} connection={connection} root={root} category={kind} onChat={onChat} onReading={setReading}/>
    </Suspense>
  </section>;
}
