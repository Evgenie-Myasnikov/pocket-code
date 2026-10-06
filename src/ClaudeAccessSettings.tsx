import {useId,useState} from 'react';
import {CircleHelp} from 'lucide-react';
import {useLanguage} from './i18n';
import {useClaudeAccess,setClaudeAccess,type ClaudeAccess} from './claude-access';
import './codex-access.css';
export function ClaudeAccessSettings(){
 const value=useClaudeAccess(),ru=useLanguage()==='ru',id=useId(),[help,setHelp]=useState(false),[error,setError]=useState('');
 const labels:Record<ClaudeAccess,string>=ru?{default:'Запрашивать подтверждение',acceptEdits:'Разрешать изменения файлов',bypassPermissions:'Полный доступ'}:{default:'Ask for approval',acceptEdits:'Accept file edits',bypassPermissions:'Full access'};
 return <section className="codex-access-settings" aria-label={ru?'Доступ Claude':'Claude access'}><fieldset><legend><span>{ru?'Доступ Claude':'Claude access'}</span><button type="button" className="icon-button codex-access-help-toggle" aria-label={ru?'О режимах доступа Claude':'About Claude access modes'} aria-expanded={help} aria-controls={id} onClick={()=>setHelp(v=>!v)}><CircleHelp size={21}/></button></legend><div className="codex-access-options">{(Object.keys(labels) as ClaudeAccess[]).map(mode=><label key={mode} className={mode===value?'selected':''}><input type="radio" name={id} checked={mode===value} onChange={()=>{try{setClaudeAccess(mode);setError('');}catch{setError(ru?'Не удалось сохранить режим.':'Could not save access mode.');}}}/><span>{labels[mode]}</span></label>)}</div></fieldset>
 <div id={id} className="codex-access-help" hidden={!help}><p>{ru?'Подтверждения: Claude спрашивает разрешение, когда оно требуется. Изменения файлов: правки разрешены автоматически, команды могут требовать подтверждения. Полный доступ: проверки разрешений Claude отключены.':'Approval: Claude asks when permission is required. File edits: edits are accepted automatically; commands may still require approval. Full access: Claude permission checks are bypassed.'}</p><p>{ru?'Применяется к следующему запуску или продолжению чата. Уточнения в уже работающем чате не меняют его доступ. Вопросы AI по задаче остаются доступны.':'Applies to the next chat run or resume. Follow-ups in an active run retain its access mode. AI clarification questions remain available.'}</p></div>{error&&<p role="alert">{error}</p>}
 </section>;
}
