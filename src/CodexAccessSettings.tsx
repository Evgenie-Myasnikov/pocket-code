import {t,useLanguage} from './i18n';
import {useId,useState} from 'react';
import {CircleHelp} from 'lucide-react';
import type {CodexAccess} from './preferences';
import {AccessOptions} from './AccessOptions';
import './codex-access.css';

export const codexAccessLabel=(access:CodexAccess)=>t(({ask:'Запрашивать подтверждение',auto:'Подтверждать за меня',full:'Полный доступ'} as const)[access]);
const descriptions={
  ask:'Codex работает в папке проекта и спрашивает, когда действию требуется подтверждение.',
  auto:'Отдельный проверяющий Codex оценивает запросы подтверждения. Ограничения доступа к папке проекта сохраняются.',
  full:'Codex может менять файлы и выполнять команды без запросов подтверждения и ограничений песочницы.',
} as const;
const consequences={ask:'Спрашивает перед действиями, которым нужно подтверждение.',auto:'Запросы оценивает проверяющий Codex, песочница папки проекта сохраняется.',full:'Команды и правки без вопросов и без ограничений песочницы.'} as const;
export function CodexAccessSettings({value,onChange}:{value:CodexAccess;onChange(value:CodexAccess):void}){
  useLanguage();
  const [showHelp,setShowHelp]=useState(false),helpId=useId(),descriptionId=useId();
  return <section className="codex-access-settings" aria-label={t('Доступ Codex')}>
    <fieldset><legend><span>{t('Доступ Codex')}</span><button className="icon-button codex-access-help-toggle" type="button" aria-label={t('О режимах доступа Codex')} title={t('О режимах доступа Codex')} aria-expanded={showHelp} aria-controls={helpId} onClick={()=>setShowHelp(open=>!open)}><CircleHelp size={20}/></button></legend><AccessOptions name="codex-access" value={value} onChange={onChange} describedBy={showHelp?descriptionId:undefined} options={(['ask','auto','full'] as const).map(option=>({value:option,label:codexAccessLabel(option),consequence:t(consequences[option]),risky:option==='full'}))}/></fieldset>
    <div className="codex-access-help" id={helpId} hidden={!showHelp}><p className="muted" id={descriptionId}>{t(descriptions[value])}</p>
    <p className="muted">{t('Сохраняется для рабочего пространства Codex. Применяется к следующему сообщению и новым задачам Jira. Уже запущенные задачи не меняются.')}</p>
    <p className="muted">{t('Это значение по умолчанию для этого устройства. Чип доступа в чате меняет режим только для этого чата.')}</p>
    <p className="muted">{t('В режиме «План» доступ всегда только для чтения.')}</p></div>
  </section>;
}
