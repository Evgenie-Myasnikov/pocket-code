import {useState} from 'react';
import {Download} from 'lucide-react';
import {request,type Connection} from './api';
import {useLanguage} from './i18n';
import {SettingRow} from './SettingsRows';

type Result=Record<'claude'|'codex'|'copilot',{imported:number;total:number}>;
const names={claude:'Claude',codex:'Codex',copilot:'Copilot'} as const;

/**
 * Settings row: the chat list holds chats made in Pocket Code; this brings in the chats that already exist in
 * Claude, Codex and Copilot on the PC. It only adds them to the list; nothing is copied or changed in the provider.
 */
export function ChatImport({connection,onImported}:{connection:Connection|null;onImported?():void}){
  const ru=useLanguage()==='ru',l=(en:string,rs:string)=>ru?rs:en;
  const [busy,setBusy]=useState(false),[result,setResult]=useState<Result>(),[error,setError]=useState('');
  async function run(){
    if(!connection||busy)return;
    setBusy(true);setError('');setResult(undefined);
    try{const value=await request<Result>(connection,'/chat-library/import',{});setResult(value);onImported?.();window.dispatchEvent(new Event('pocket-chat-project-added'));}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const summary=result&&(Object.keys(names) as (keyof Result)[]).filter(id=>result[id]).map(id=>names[id]+' · '+result[id].imported).join(', ');
  return <SettingRow title={l('Import chats','Импорт чатов')} note={result?l('Added: ','Добавлено: ')+(summary||'0'):error||l('Add the chats Claude, Codex and Copilot already have on this PC','Добавить чаты, которые уже есть у Claude, Codex и Copilot на этом ПК')}>
    <button type="button" className="secondary" disabled={!connection||busy} onClick={()=>void run()}><Download size={16} aria-hidden="true"/>{busy?l('Importing…','Импортируем…'):l('Import','Импортировать')}</button>
  </SettingRow>;
}
