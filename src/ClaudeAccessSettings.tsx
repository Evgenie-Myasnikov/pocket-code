import {useId,useState} from 'react';
import {CircleHelp,ShieldAlert} from 'lucide-react';
import {HelpTip,SettingRow} from './SettingsRows';
import {t,useLanguage} from './i18n';
import {useClaudeAccess,setClaudeAccess,type ClaudeAccess} from './claude-access';
import {AccessOptions,type AccessOption} from './AccessOptions';
import './codex-access.css';
export const claudeAccessLabel=(access:ClaudeAccess)=>t(({default:'Запрашивать подтверждение',acceptEdits:'Разрешать изменения файлов',bypassPermissions:'Полный доступ'} as const)[access]);
/** row: one settings row with a select, for the provider card in the PC window; otherwise the radio cards of the phone. */
export function ClaudeAccessSettings({row=false}:{row?:boolean}={}){
 useLanguage();
 const value=useClaudeAccess(),id=useId(),[help,setHelp]=useState(false),[error,setError]=useState('');
 const options:AccessOption<ClaudeAccess>[]=[{value:'default',label:claudeAccessLabel('default'),consequence:t('Агент просит разрешение на команды и правки.')},{value:'acceptEdits',label:claudeAccessLabel('acceptEdits'),consequence:t('Файлы меняются без вопроса, команды — по запросу.')},{value:'bypassPermissions',label:claudeAccessLabel('bypassPermissions'),consequence:t('Команды и правки без вопросов, проверки разрешений отключены.'),risky:true}];
 const save=(mode:ClaudeAccess)=>{try{setClaudeAccess(mode);setError('');}catch{setError(t('Не удалось сохранить режим.'));}};
 if(row){const selected=options.find(option=>option.value===value)!;return <SettingRow title={t('Доступ агента')} htmlFor={id+'-select'} noteId={id+'-note'} note={<>{selected.risky&&<ShieldAlert size={14} aria-hidden="true"/>}{error||selected.consequence}</>} help={<HelpTip label={t('О режимах доступа Claude')}>{t('Применяется к следующему запуску или продолжению чата. Уточнения в уже работающем чате не меняют его доступ. Вопросы AI по задаче остаются доступны.')} {t('Это значение по умолчанию для этого устройства. Чип доступа в чате меняет режим только для этого чата.')}</HelpTip>}><select id={id+'-select'} aria-describedby={id+'-note'} value={value} onChange={event=>save(event.target.value as ClaudeAccess)}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></SettingRow>;}
 return <section className="codex-access-settings" aria-label={t('Доступ Claude')}><fieldset><legend><span>{t('Доступ Claude')}</span><button type="button" className="icon-button codex-access-help-toggle" aria-label={t('О режимах доступа Claude')} title={t('О режимах доступа Claude')} aria-expanded={help} aria-controls={id} onClick={()=>setHelp(v=>!v)}><CircleHelp size={20}/></button></legend><AccessOptions value={value} options={options} onChange={save}/></fieldset>
 <div id={id} className="codex-access-help" hidden={!help}><p>{t('Подтверждения: Claude спрашивает разрешение, когда оно требуется. Изменения файлов: правки разрешены автоматически, команды могут требовать подтверждения. Полный доступ: проверки разрешений Claude отключены.')}</p><p>{t('Применяется к следующему запуску или продолжению чата. Уточнения в уже работающем чате не меняют его доступ. Вопросы AI по задаче остаются доступны.')}</p><p>{t('Это значение по умолчанию для этого устройства. Чип доступа в чате меняет режим только для этого чата.')}</p></div>{error&&<p className="error-banner" role="alert">{error}</p>}
 </section>;
}
