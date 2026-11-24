import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Sparkles} from 'lucide-react';
import {request,type Connection} from './api';
import {codexTaskTextBytes,CODEX_TASK_TEXT_BYTES} from './task-text-limit';
import {descriptionTitle} from './MarkdownTaskEditor';
import {useLanguage} from './i18n';
import {useModal} from './navigation';
import './markdown-task-dialog.css';
import './chain-editor.css';

type Provider='claude'|'codex'|'copilot';
type Choice={id:string;label:string;provider:Provider|'custom';account?:string};
const names:Record<Provider,string>={claude:'Claude',codex:'Codex',copilot:'GitHub Copilot'};
const remembered='pocket.cardPromptProvider';
const recall=()=>{try{return localStorage.getItem(remembered)||'';}catch{return '';}};

/** One prompt becomes a filled card: the chosen provider drafts the description, then the title, through the task text API. */
export function CardPromptDialog({connection,cwd,onClose,onCreate}:{connection:Connection;cwd:string;onClose():void;onCreate(card:{text:string;description:string}):Promise<boolean>}){
  const ru=useLanguage()==='ru',l=(en:string,ruText:string)=>ru?ruText:en;
  const root=useRef<HTMLElement>(null),heading=useId();
  const [prompt,setPrompt]=useState(''),[choices,setChoices]=useState<Choice[]>(),[choice,setChoice]=useState(recall);
  const [stage,setStage]=useState<''|'description'|'title'|'saving'>(''),[error,setError]=useState('');
  const live=useRef(true),lock=useRef(false);
  useModal(root,true,()=>{if(!stage)onClose();});
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  useEffect(()=>{
    let active=true;
    request<{providers?:Provider[];accounts?:{id:string;name:string}[]}>(connection,'/task-text/providers').then(data=>{
      if(!active)return;
      const list:Choice[]=[...(Array.isArray(data?.providers)?data.providers:[]).filter(id=>Object.hasOwn(names,id)).map(id=>({id,label:names[id],provider:id})),
        ...(Array.isArray(data?.accounts)?data.accounts:[]).filter(a=>a&&typeof a.id==='string'&&typeof a.name==='string').map(a=>({id:'account:'+a.id,label:a.name,provider:'custom' as const,account:a.id}))];
      setChoices(list);setChoice(old=>list.some(item=>item.id===old)?old:list[0]?.id||'');
    }).catch(()=>{if(active)setChoices([]);});
    return()=>{active=false;};
  },[connection.url,connection.token,connection.desktop]);
  const selected=choices?.find(item=>item.id===choice),text=prompt.trim();
  // Without a provider, or when drafting fails, the same text still becomes a card: first line as the title.
  const plain=()=>({text:descriptionTitle(text).slice(0,160),description:text});
  async function save(card:{text:string;description:string}){
    setStage('saving');
    try{if(!await onCreate(card)&&live.current)setError(l('The board did not save the card. Refresh the board and try again.','Доска не сохранила карточку. Обновите доску и повторите.'));}
    finally{lock.current=false;if(live.current)setStage('');}
  }
  async function draft(){
    if(!text||!selected||lock.current)return;
    lock.current=true;setError('');setStage('description');
    try{localStorage.setItem(remembered,selected.id);}catch{/* The choice is a convenience only. */}
    try{
      let model:string|undefined;
      if(selected.provider==='custom'){
        const models=await request<string[]>(connection,'/custom-providers/'+encodeURIComponent(selected.account!)+'/models');
        model=Array.isArray(models)?models[0]:undefined;
        if(!model)throw Error(l('This connection has no available models.','У подключения нет доступных моделей.'));
      }
      const ask=async(field:'description'|'title',context:string,maxLength:number)=>{
        if(selected.provider==='codex'&&codexTaskTextBytes('',context)>CODEX_TASK_TEXT_BYTES)throw Error(l('Codex accepts up to 4,000 bytes. Shorten the text or choose another provider.','Codex принимает до 4 000 байт. Сократите текст или выберите другого провайдера.'));
        const answer=await request<{text:string}>(connection,'/task-text/improve',{cwd,provider:selected.provider,...(selected.provider==='custom'?{account:selected.account,model}:{}),field,text:'',context,language:ru?'ru':'en',maxLength});
        if(typeof answer?.text!=='string'||!answer.text.trim())throw Error(l('The provider returned an empty response.','Провайдер вернул пустой ответ.'));
        return answer.text.trim();
      };
      const description=await ask('description',text,20000);
      if(!live.current)return;
      setStage('title');
      let title:string;
      try{title=await ask('title',text.slice(0,1500),160);}catch{title=plain().text;}
      if(!live.current)return;
      await save({text:title.slice(0,160),description});
    }catch(e){lock.current=false;if(live.current){setError(e instanceof Error?e.message:String(e));setStage('');}}
  }
  const busy=!!stage;
  return createPortal(<div className="modal-backdrop" onKeyDown={e=>e.stopPropagation()}>
    <section ref={root} className="confirm-modal markdown-task-dialog chain-editor card-prompt" role="dialog" aria-modal="true" aria-labelledby={heading}>
      <header><h2 id={heading}>{l('New card','Новая карточка')}</h2></header>
      <textarea autoFocus rows={4} maxLength={4000} disabled={busy} value={prompt} aria-label={l('What is the card about?','О чём карточка?')}
        placeholder={l('Describe the idea in a sentence or two. AI writes the title and the description.','Опишите идею в одном-двух предложениях. ИИ напишет название и описание.')}
        onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();void draft();}}}/>
      {choices&&choices.length>1&&<select aria-label={l('Provider','Провайдер')} disabled={busy} value={choice} onChange={e=>setChoice(e.target.value)}>{choices.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>}
      {choices?.length===0&&<small role="status">{l('No text provider is available. The card is created from your text as it is.','Нет доступного провайдера. Карточка будет создана из вашего текста как есть.')}</small>}
      {busy&&<p role="status">{stage==='description'?l('Writing the description…','Пишет описание…'):stage==='title'?l('Writing the title…','Пишет название…'):l('Saving the card…','Сохраняет карточку…')}</p>}
      {error&&<p role="alert" className="error-banner">{error}</p>}
      <footer>
        <button type="button" className="secondary" disabled={busy} onClick={onClose}>{l('Cancel','Отмена')}</button>
        <button type="button" className="secondary" disabled={busy||!text} onClick={()=>{if(!lock.current){lock.current=true;void save(plain());}}}>{l('Without AI','Без ИИ')}</button>
        <button type="button" className="primary" disabled={busy||!text||!selected} onClick={()=>void draft()}><Sparkles size={16} aria-hidden="true"/>{l('Create card','Создать карточку')}</button>
      </footer>
    </section>
  </div>,document.body);
}
