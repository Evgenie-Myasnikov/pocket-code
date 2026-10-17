import {useEffect,useRef,useState} from 'react';
import {Sparkles} from 'lucide-react';
import {request,type Connection} from './api';
import {t} from './i18n';

/** The built-in board rule as one card: a trailing switch saved optimistically, with Saving/Saved feedback and rollback on failure. */
export function ProjectRuleSwitch({connection,root,onOpen,onChange}:{connection:Connection;root:string;onOpen?():void;onChange?(enabled:boolean):void}){
  const [settings,setSettings]=useState<{boardMaintenance:boolean;canEdit:boolean}|null>(null);
  const [saving,setSaving]=useState<'idle'|'saving'|'saved'>('idle'),[error,setError]=useState(''),[loadError,setLoadError]=useState(false);
  const savedTimer=useRef(0);
  useEffect(()=>{let cancelled=false;setSettings(null);setLoadError(false);request<{boardMaintenance:boolean;canEdit:boolean}>(connection,'/project-rules?cwd='+encodeURIComponent(root)).then(value=>{if(!cancelled){setSettings(value);onChange?.(value.boardMaintenance);}}).catch(()=>{if(!cancelled)setLoadError(true);});return()=>{cancelled=true;window.clearTimeout(savedTimer.current);};},[connection,root]);
  async function toggle(){
    if(!settings?.canEdit||saving==='saving')return;
    const previous=settings,enabled=!settings.boardMaintenance;
    setSettings({...settings,boardMaintenance:enabled});onChange?.(enabled);setSaving('saving');setError('');window.clearTimeout(savedTimer.current);
    try{const value=await request<{boardMaintenance:boolean;canEdit:boolean}>(connection,'/project-rules',{cwd:root,boardMaintenance:enabled});setSettings(value);onChange?.(value.boardMaintenance);setSaving('saved');savedTimer.current=window.setTimeout(()=>setSaving('idle'),2000);}
    catch(e){setSettings(previous);onChange?.(previous.boardMaintenance);setSaving('idle');setError((e as Error).message);}
  }
  const on=Boolean(settings?.boardMaintenance);
  return <section className="project-built-in-rule" aria-busy={!settings&&!loadError}>
    <Sparkles size={20} aria-hidden="true"/>
    <div className="project-built-in-rule-text">
      <strong id="built-in-rule-title">{t('Обслуживание доски')}</strong>
      <small>{t('Встроено в Pocket Code · применяется со следующего запуска AI')}</small>
      {onOpen&&<button className="text-button" onClick={onOpen}>{t('Что делает правило')}</button>}
      <span className="project-built-in-rule-status" role="status">{saving==='saving'?t('Сохраняю…'):saving==='saved'?t('Сохранено'):settings&&!settings.canEdit?t('Изменить может только владелец ПК'):loadError?t('Не удалось прочитать настройку правила'):''}</span>
      {error&&<p className="project-docs-inline-error" role="alert">{t('Не удалось сохранить: {0}',t(error))}</p>}
    </div>
    {settings?<button type="button" role="switch" className="rule-switch" aria-checked={on} aria-labelledby="built-in-rule-title" disabled={!settings.canEdit||saving==='saving'} onClick={()=>void toggle()}><span aria-hidden="true"/></button>:<span className="rule-switch skeleton" aria-hidden="true"/>}
  </section>;
}
