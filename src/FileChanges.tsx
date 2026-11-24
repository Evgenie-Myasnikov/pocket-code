import {useState,type ReactNode} from 'react';
import {useLanguage} from './i18n';
import type {FileChange} from './turn-changes';
import './file-changes.css';

const signs={add:'+',del:'-',context:' ',meta:''};

/** The lines a turn changed in one file: added and removed lines in colour, with the unchanged lines around them. */
export function FileChanges({change}:{change:FileChange}){
  const ru=useLanguage()==='ru',shown=change.lines.slice(0,4000);
  return <div className="file-changes">
    <p className="file-changes-summary"><b data-kind="add">+{change.added}</b> <b data-kind="del">−{change.removed}</b> <span>{ru?'строк изменено в этом ходе':'lines changed in this turn'}</span></p>
    <pre className="file-changes-diff" tabIndex={0} aria-label={ru?'Изменения файла':'File changes'}>
      {shown.map((row,index)=>row.kind==='meta'?<span key={index} className="file-changes-gap" data-line="meta" aria-hidden="true">{'\n'}</span>:
        <span key={index} data-line={row.kind}><span className="file-changes-sign" aria-hidden="true">{signs[row.kind]}</span><code>{row.text}</code>{'\n'}</span>)}
      {change.lines.length>shown.length&&<span data-line="meta">{(ru?'Ещё строк: ':'More lines: ')+(change.lines.length-shown.length)}</span>}
    </pre>
  </div>;
}

/** A file opened from a turn result shows what changed first; the whole file is one switch away. Without changes it is just the file. */
export function FileWithChanges({change,children}:{change?:FileChange;children:ReactNode}){
  const ru=useLanguage()==='ru',[view,setView]=useState<'changes'|'file'>('changes');
  if(!change?.lines.length)return <>{children}</>;
  return <div className="file-with-changes">
    <div className="file-with-changes-switch" role="group" aria-label={ru?'Вид файла':'File view'}>
      <button type="button" aria-pressed={view==='changes'} onClick={()=>setView('changes')}>{ru?'Изменения':'Changes'}</button>
      <button type="button" aria-pressed={view==='file'} onClick={()=>setView('file')}>{ru?'Файл':'File'}</button>
    </div>
    {view==='changes'?<FileChanges change={change}/>:children}
  </div>;
}
