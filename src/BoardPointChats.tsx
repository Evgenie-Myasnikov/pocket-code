import {lazy,Suspense,useCallback,useEffect,useMemo,useState} from 'react';
import {useReactFlow,useViewport} from '@xyflow/react';
import {MessageSquare,Minus,Trash2,X,SlidersHorizontal} from 'lucide-react';
import {request,type Connection} from './api';
import {CardActionMenu,type CardAction} from './CardActionMenu';
import {setCustomAccount} from './custom-account';
import type {BoardView} from './WorkBoards';
import {boardSelectionContext} from './board-selection-context';
import {selectedWorkspace,type WorkspaceProvider} from './preferences';
import type {Session} from './session';
import {useLanguage} from './i18n';
import './board-point-chats.css';
export {nearestCards} from './board-nearest-cards';

// The chat itself is the application's own chat view; it is loaded when the first chat opens.
const EmbeddedChat=lazy(()=>import('./App').then(module=>({default:module.App})));

/** A chat started from a point of the board. It keeps the cards that were nearest to that point as its context. */
export type PointChat={id:string;x:number;y:number;cardIds:string[];collapsed:boolean;provider:WorkspaceProvider;account?:string;model?:string;session?:Session};
type Executor={provider:WorkspaceProvider;account?:string;model?:string;label:string};
/** The chat view keeps its own model list; the window drives that list instead of duplicating the provider catalogue. */
const modelSelect=(chatId:string)=>document.querySelector<HTMLSelectElement>(`[data-point-chat="${chatId}"] .model-picker select`);
function chooseModel(chatId:string,value:string){
  const select=modelSelect(chatId);if(!select||![...select.options].some(option=>option.value===value))return false;
  if(select.value!==value){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(select,value);select.dispatchEvent(new Event('change',{bubbles:true}));}
  return true;
}
const storageKey=(connection:Connection,board:Pick<BoardView,'root'|'id'>)=>'pocket.boardPointChats:'+JSON.stringify([connection.url,connection.workspaceId||'',board.root,board.id]);
function read(key:string):PointChat[]{
  try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter(chat=>chat&&typeof chat.id==='string'&&Number.isFinite(chat.x)&&Number.isFinite(chat.y)&&Array.isArray(chat.cardIds)):[];}catch{return [];}
}
/** Point chats are private to this installation, like the other board chat links: they are not written to the board file. */
export function usePointChats(connection:Connection,board:Pick<BoardView,'root'|'id'>|null){
  const key=board?storageKey(connection,board):'';
  const [chats,setChats]=useState<PointChat[]>(()=>key?read(key):[]);
  useEffect(()=>{setChats(key?read(key):[]);},[key]);
  const update=useCallback((change:(old:PointChat[])=>PointChat[])=>setChats(old=>{const next=change(old);if(key)try{localStorage.setItem(key,JSON.stringify(next));}catch{/* The chats stay for this visit. */}return next;}),[key]);
  return {chats,
    start:(point:{x:number;y:number},cardIds:string[])=>update(old=>[...old.map(chat=>({...chat,collapsed:true})),{id:crypto.randomUUID(),x:Math.round(point.x),y:Math.round(point.y),cardIds,collapsed:false,provider:selectedWorkspace()}].slice(-24)),
    patch:(id:string,value:Partial<PointChat>)=>update(old=>old.map(chat=>chat.id===id?{...chat,...value}:value.collapsed===false?{...chat,collapsed:true}:chat)),
    remove:(id:string)=>update(old=>old.filter(chat=>chat.id!==id))};
}

/** Rendered inside the canvas: every chat stays pinned to its point while the board pans and zooms. */
export function BoardPointChats({connection,board,chats,patch,remove}:{connection:Connection;board:BoardView;chats:PointChat[];patch(id:string,value:Partial<PointChat>):void;remove(id:string):void}){
  const ru=useLanguage()==='ru',l=(en:string,ruText:string)=>ru?ruText:en;
  const view=useViewport(),flow=useReactFlow();
  const titles=useMemo(()=>new Map(board.notes.map(note=>[note.id,note.title])),[board.notes]);
  const [confirming,setConfirming]=useState(''),[listed,setListed]=useState('');
  const [executors,setExecutors]=useState<Executor[]>([]),[menu,setMenu]=useState<{chat:PointChat;x:number;y:number;models:{value:string;label:string;current:boolean}[]}|null>(null);
  useEffect(()=>{let active=true;request<{executors?:Executor[]}>(connection,'/task-text/plan/providers').then(data=>{if(active)setExecutors((Array.isArray(data?.executors)?data.executors:[]).filter(item=>item&&typeof item.label==='string'&&typeof item.provider==='string'));}).catch(()=>{});return()=>{active=false;};},[connection.url,connection.token,connection.desktop]);
  // A model remembered for a chat is applied once its chat view has loaded the model list.
  const wanted=chats.filter(chat=>!chat.collapsed&&chat.model).map(chat=>chat.id+':'+chat.model+':'+chat.provider+':'+(chat.account||'')).join('|');
  useEffect(()=>{if(!wanted)return;let tries=0;const timer=setInterval(()=>{const pending=chats.filter(chat=>!chat.collapsed&&chat.model&&!chooseModel(chat.id,chat.model));if(!pending.length||++tries>20)clearInterval(timer);},150);return()=>clearInterval(timer);},[wanted]);
  function openMenu(chat:PointChat,button:HTMLElement){
    const box=button.getBoundingClientRect(),select=modelSelect(chat.id);
    const models=select?[...select.options].filter(option=>option.value&&!option.disabled&&!option.textContent?.includes('…')).map(option=>({value:option.value,label:option.textContent||option.value,current:option.value===select.value})):[];
    setMenu({chat,x:box.left,y:box.top-8,models});
  }
  const menuItems:CardAction[]=!menu?[]:[
    ...executors.map(item=>{const current=item.provider===menu.chat.provider&&(item.account||'')===(menu.chat.account||'')&&(!item.account||!menu.chat.model||item.model===menu.chat.model);
      const other=item.provider!==menu.chat.provider||(item.account||'')!==(menu.chat.account||'');
      return {label:item.label,current,disabled:other&&!!menu.chat.session,onSelect:()=>{if(item.provider==='claude')setCustomAccount(item.account||'');patch(menu.chat.id,{provider:item.provider,account:item.account,model:item.model});}};}),
    ...menu.models.filter(model=>!executors.some(item=>item.account&&item.account===menu.chat.account&&item.model===model.value)).map(model=>({label:l('Model: ','Модель: ')+model.label,current:model.current,onSelect:()=>{chooseModel(menu.chat.id,model.value);patch(menu.chat.id,{model:model.value});}})),
  ];
  return <div className="board-point-chats nodrag nowheel nopan">{chats.map(chat=>{
    const cards=chat.cardIds.filter(id=>titles.has(id)),left=chat.x*view.zoom+view.x,top=chat.y*view.zoom+view.y;
    const label=chat.session?.customTitle||chat.session?.summary||(cards.length?titles.get(cards[0])!:l('Chat on the board','Чат на доске'));
    if(chat.collapsed)return <button key={chat.id} type="button" className="board-point-pin" style={{left,top}} title={label} aria-label={l('Open chat: ','Открыть чат: ')+label} onClick={()=>patch(chat.id,{collapsed:false})}><MessageSquare size={15} aria-hidden="true"/>{cards.length>0&&<span>{cards.length}</span>}</button>;
    return <section key={chat.id} data-point-chat={chat.id} className="board-point-chat" style={{left,top}} aria-label={l('Chat on the board','Чат на доске')} onKeyDown={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()} onContextMenu={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
      <header>
        <MessageSquare size={15} aria-hidden="true"/><strong title={label}>{label}</strong>
        {cards.length>0&&<button type="button" className="board-point-count" aria-expanded={listed===chat.id} title={l('Attached cards','Прикреплённые карточки')} onClick={()=>setListed(listed===chat.id?'':chat.id)}>{l('Cards: ','Карточек: ')}{cards.length}</button>}
        <button type="button" aria-label={l('Collapse chat','Свернуть чат')} title={l('Collapse','Свернуть')} onClick={()=>patch(chat.id,{collapsed:true})}><Minus size={15}/></button>
        <button type="button" aria-label={l('Remove chat from the board','Убрать чат с доски')} title={l('Remove from the board','Убрать с доски')} onClick={()=>setConfirming(chat.id)}><Trash2 size={15}/></button>
      </header>
      {confirming===chat.id&&<div className="board-point-confirm" role="alertdialog" aria-label={l('Remove this chat from the board?','Убрать этот чат с доски?')}>
        <span>{chat.session?l('The conversation stays in the chat list.','Переписка останется в списке чатов.'):l('Remove this chat from the board?','Убрать этот чат с доски?')}</span>
        <button type="button" onClick={()=>setConfirming('')}>{l('Keep','Оставить')}</button><button type="button" className="danger" onClick={()=>{setConfirming('');remove(chat.id);}}>{l('Remove','Убрать')}</button>
      </div>}
      {listed===chat.id&&cards.length>0&&<ul className="board-point-cards" aria-label={l('Attached cards','Прикреплённые карточки')}>{cards.map(id=><li key={id}>
        <button type="button" title={l('Show on the board','Показать на доске')} onClick={()=>{const item=board.canvas?.items.find(i=>i.id===id),note=board.notes.find(n=>n.id===id);if(note)void flow.setCenter(note.x+(item?.width||280)/2,note.y+(item?.height||280)/2,{zoom:Math.max(view.zoom,.6),duration:200});}}>{titles.get(id)}</button>
        <button type="button" aria-label={l('Detach card: ','Открепить карточку: ')+titles.get(id)} onClick={()=>patch(chat.id,{cardIds:chat.cardIds.filter(card=>card!==id)})}><X size={12}/></button>
      </li>)}</ul>}
      <div className="board-point-body">{!chat.session&&<p className="board-point-hint">{cards.length?l('Ask about the attached cards.','Спросите о прикреплённых карточках.'):l('Ask about this part of the board.','Спросите об этой части доски.')}</p>}<Suspense fallback={<p role="status">{l('Loading…','Загрузка…')}</p>}>
        <EmbeddedChat key={chat.provider+':'+(chat.account||'')} embedded={{connection,provider:chat.session?.provider||chat.provider,cwd:board.root,session:chat.session,boardSelection:boardSelectionContext(connection,board,cards),
          onCreated:session=>patch(chat.id,{session:{...session,provider:session.provider||chat.provider}}),onBack:()=>patch(chat.id,{collapsed:true})}}/>
      </Suspense>
        <button type="button" className="board-point-model" aria-haspopup="menu" aria-label={l('Provider and model','Провайдер и модель')} title={l('Provider and model','Провайдер и модель')} onClick={event=>openMenu(chat,event.currentTarget)}><SlidersHorizontal size={15}/></button>
      </div>
    </section>;
  })}{menu&&<CardActionMenu label={l('Provider and model','Провайдер и модель')} point={menu} items={menuItems} onClose={()=>setMenu(null)}/>}</div>;
}
