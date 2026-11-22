import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useModal} from './navigation';
import './chat-delete-options.css';
import type {MarkdownChainControls} from './MarkdownChainPanel';
import type {ChainDeletePreview,MarkdownChainDetail} from './markdown-chain';

const providers={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};

export function ChainDeleteDialog({chain,controls,ru,onClose,onDeleted}:{
  chain:MarkdownChainDetail;controls:MarkdownChainControls;ru:boolean;onClose():void;onDeleted():void;
}){
  const tr=(en:string,rs:string)=>ru?rs:en;
  const single=chain.steps.length===1;
  const title=single?tr('Delete task','Удалить задачу'):tr('Delete chain','Удалить цепочку');
  const [permanent,setPermanent]=useState(false),[preview,setPreview]=useState<ChainDeletePreview>();
  const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [partial,setPartial]=useState<ChainDeletePreview>(),[revision,setRevision]=useState(0);
  const latest=useRef(controls),lock=useRef(false),root=useRef<HTMLElement>(null);
  const active=useRef(true);
  latest.current=controls;
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useModal(root,true,()=>{if(!lock.current)onClose();});
  useEffect(()=>{
    if(!permanent)return;
    let live=true;
    setLoading(true);setError('');setPreview(undefined);
    (async()=>{
      try{
        const data=await latest.current.previewDeletion!(chain.id);
        if(data?.eraseOriginals!==true||!Array.isArray(data.chats)||!Array.isArray(data?.unavailable)||!Array.isArray(data?.running))
          throw new Error(tr('Update the PC host to check linked chats.','Обновите хост на ПК, чтобы проверить связанные чаты.'));
        if(live)setPreview(data);
      }catch(e){if(live)setError(e instanceof Error?e.message:String(e));}
      finally{if(live)setLoading(false);}
    })();
    return()=>{live=false;};
  },[permanent,chain.id,revision,ru]);
  async function remove(){
    if(!controls.remove||lock.current||permanent&&(!preview?.chats.length||partial))return;
    lock.current=true;setBusy(true);setError('');
    try{
      const result=await controls.remove(chain.id,permanent?preview!.chats:undefined);
      if(!active.current)return;
      if(permanent&&(result?.eraseOriginals!==true||typeof result.ok!=='boolean'||!Array.isArray(result.chats)))throw new Error(tr('The host did not confirm removal. Refresh to check the remaining chats.','Хост не подтвердил удаление. Обновите список связанных чатов.'));
      if(result?.ok===false){setPartial(result);setPreview(undefined);}
      else onDeleted();
    }catch(e){if(active.current)setError(e instanceof Error?e.message:String(e));}
    finally{lock.current=false;if(active.current)setBusy(false);}
  }
  const details=partial??preview;
  function retry(){setPartial(undefined);setPreview(undefined);setRevision(value=>value+1);}
  function choose(value:boolean){setPermanent(value);setPreview(undefined);setPartial(undefined);setError('');}
  return createPortal(<div className="modal-backdrop"><section ref={root} className="confirm-modal chain-delete-dialog" role="alertdialog" aria-modal="true" aria-label={title}>
    <h2>{title}</h2><p className="chain-delete-name">{chain.name}</p>
    <fieldset disabled={busy} className="chain-delete-options">
      <legend>{tr('What to delete','Что удалить')}</legend>
      <label><input type="radio" checked={!permanent} onChange={()=>choose(false)} name="delete-chain-scope"/><span>{single?tr('Task only','Только задачу'):tr('Chain only','Только цепочку')}</span></label>
      {!!controls.previewDeletion&&<label><input type="radio" checked={permanent} onChange={()=>choose(true)} name="delete-chain-scope"/><span>{single?tr('Task, original chats and cache','Задачу, оригиналы чатов и кэш'):tr('Chain, original chats and cache','Цепочку, оригиналы чатов и кэш')}</span></label>}
    </fieldset>
    {!permanent&&<p>{tr('The saved steps and results will be deleted. You can still open the chats from your chat list.','Шаги и результаты будут удалены. Переписку можно будет открыть в списке чатов.')}</p>}
    {permanent&&<>
      <p>{tr('This permanently erases the confirmed conversations from provider history and clears their cached copies on this device.','Подтверждённые переписки будут безвозвратно удалены из истории провайдеров и из кэша на этом устройстве.')}</p>
      {loading&&<p role="status">{tr('Checking linked chats…','Проверяем связанные чаты…')}</p>}
      {details&&<div role="status" className="chain-delete-counts">
        <strong>{partial?tr('Original chats deleted','Удалено оригиналов чатов'):tr('Original chats to delete','Оригиналов чатов к удалению')} · {details.chats.length}</strong>
        {!!details.running.length&&<span>{tr('In use','Активные чаты')} · {details.running.length}</span>}
        {!!details.unavailable.length&&<span>{tr('Unavailable','Недоступны')} · {details.unavailable.length}</span>}
        {!!details.unsupported?.length&&<span>{tr('Provider does not support deletion','Провайдер не поддерживает удаление')} · {details.unsupported.length}</span>}
        {!!details.failed?.length&&<span>{tr('Failed to erase','Не удалось удалить')} · {details.failed.length}</span>}
        {!!details.unknownCount&&<span>{tr('Attempts without a known chat ID','Попытки без известного ID чата')} · {details.unknownCount}</span>}
      </div>}
      {preview&&preview.chats.length>0&&<details className="chain-delete-ids"><summary>{tr('Review chats','Посмотреть чаты')}</summary><ul>{preview.chats.map(chat=>{
        const step=chain.steps.find(s=>s.sessionId===chat.sessionId&&(s.executor?.provider??chain.provider)===chat.provider);
        return <li key={JSON.stringify([chat.provider,chat.account,chat.sessionId])}><span>{providers[chat.provider]}{step?' · '+step.title:''}</span><code>{chat.sessionId}</code></li>;
      })}</ul></details>}
      {partial&&<p>{tr('The task record is still available. Check the remaining chats to retry, or choose to delete the record only.','Запись задачи сохранена. Проверьте оставшиеся чаты для повтора или выберите удаление только записи.')}</p>}
    </>}
    {error&&<p className="chain-step-error" role="alert">{error}</p>}
    <footer><button type="button" className="secondary" disabled={busy} onClick={onClose}>{tr('Cancel','Отмена')}</button>
      {permanent&&(partial||error&&!preview||preview&&!preview.chats.length)&&<button type="button" className="secondary" disabled={busy||loading} onClick={retry}>{tr('Check again','Проверить снова')}</button>}
      <button type="button" className="primary danger" disabled={busy||permanent&&(!preview?.chats.length||loading)} onClick={()=>void remove()}>{busy?tr('Deleting…','Удаление…'):permanent?tr('Erase permanently','Удалить безвозвратно'):tr('Delete','Удалить')}</button>
    </footer></section></div>,document.body);
}
