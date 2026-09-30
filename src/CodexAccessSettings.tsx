import {t} from './i18n';
import {useId,useState} from 'react';
import {CircleHelp} from 'lucide-react';
import type {CodexAccess} from './preferences';
import './codex-access.css';

export const codexAccessLabel=(access:CodexAccess)=>t(({ask:'Запрашивать подтверждение',auto:'Подтверждать за меня',full:'Полный доступ'} as const)[access]);
const descriptions={
  ask:'Codex работает в папке проекта и спрашивает, когда действию требуется подтверждение.',
  auto:'Отдельный проверяющий Codex оценивает запросы подтверждения. Ограничения доступа к папке проекта сохраняются.',
  full:'Codex может менять файлы и выполнять команды без запросов подтверждения и ограничений песочницы.',
} as const;
export function CodexAccessSettings({value,onChange}:{value:CodexAccess;onChange(value:CodexAccess):void}){
  const [showHelp,setShowHelp]=useState(false),helpId=useId(),descriptionId=useId();
  return <section className="codex-access-settings" aria-label={t('Доступ Codex')}>
    <fieldset><legend><span>{t('Доступ Codex')}</span><button className="icon-button codex-access-help-toggle" type="button" aria-label={t('О режимах доступа Codex')} title={t('О режимах доступа Codex')} aria-expanded={showHelp} aria-controls={helpId} onClick={()=>setShowHelp(open=>!open)}><CircleHelp size={21}/></button></legend><div className="codex-access-options">{(['ask','auto','full'] as const).map(option=><label key={option} className={option===value?'selected':''}><input type="radio" name="codex-access" value={option} checked={value===option} onChange={()=>onChange(option)} aria-describedby={showHelp?descriptionId:undefined}/><span>{codexAccessLabel(option)}</span></label>)}</div></fieldset>
    <div className="codex-access-help" id={helpId} hidden={!showHelp}><p className="muted" id={descriptionId}>{t(descriptions[value])}</p>
    <p className="muted">{t('Сохраняется для рабочего пространства Codex. Применяется к следующему сообщению и новым задачам Jira. Уже запущенные задачи не меняются.')}</p>
    <p className="muted">{t('В режиме «План» доступ всегда только для чтения.')}</p></div>
  </section>;
}
