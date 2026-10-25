import type {Connection} from './api';
import type {BoardView} from './WorkBoards';
import {boardChatContext} from './board-chat-context';
import {sameImageConnection} from './board-image-drag';
export type BoardSelection={connection:Connection;root:string;boardId:string;ids:string[];content:string;titles:string[]};
export function boardSelectionContext(connection:Connection,board:BoardView,ids:string[]):BoardSelection|null{
 const valid=new Set([...board.notes.map(n=>n.id),...(board.canvas?.items||[]).map(i=>i.id)]),selected=[...new Set(ids)].filter(id=>valid.has(id));if(!selected.length)return null;
 return {connection,root:board.root,boardId:board.id,ids:selected,content:boardChatContext(board,selected),titles:selected.map(id=>board.notes.find(n=>n.id===id)?.title||board.canvas?.items.find(i=>i.id===id)?.text||id)};
}
export function matchingBoardSelection(selection:BoardSelection|null|undefined,connection:Connection|null,root:string,boardId?:string){return selection&&connection&&selection.boardId===boardId&&selection.root===root&&sameImageConnection(selection.connection,connection)?selection:null;}
