import type {Connection} from './api';
import type {BoardView} from './WorkBoards';
import {boardChatContext} from './board-chat-context';
import {sameImageConnection,type BoardImage} from './board-image-drag';
export type BoardSelectionObject={id:string;title:string;kind:string;images?:BoardImage[]};
export type BoardSelection={connection:Connection;root:string;boardId:string;ids:string[];content:string;titles:string[];boardName?:string;objects?:BoardSelectionObject[]};
export function boardSelectionContext(connection:Connection,board:BoardView,ids:string[]):BoardSelection|null{
 const valid=new Set([...board.notes.map(n=>n.id),...(board.canvas?.items||[]).map(i=>i.id)]),selected=[...new Set(ids)].filter(id=>valid.has(id));if(!selected.length)return null;
 const notes=new Map(board.notes.map(note=>[note.id,note])),items=new Map((board.canvas?.items||[]).map(item=>[item.id,item]));
 const objects=selected.map(id=>{const note=notes.get(id),item=items.get(id);return {id,title:(note?.title||item?.text||'').trim(),kind:note?'card':item?.kind||'card',images:note?.images?.map(image=>({...image}))};});
 return {connection:{...connection},root:board.root,boardId:board.id,boardName:board.name,ids:selected,content:boardChatContext(board,selected),titles:objects.map(object=>object.title||'Untitled object'),objects};
}
export function matchingBoardSelection(selection:BoardSelection|null|undefined,connection:Connection|null,root:string,boardId?:string){return selection&&connection&&selection.boardId===boardId&&selection.root===root&&sameImageConnection(selection.connection,connection)?selection:null;}
