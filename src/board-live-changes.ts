import type {BoardView} from './WorkBoards';
/** Product fields only: private assignments never become visual edit activity. */
export function changedBoardObjects(before:BoardView,after:BoardView){
 const snapshots=(board:BoardView)=>new Map([...board.notes.map(({id,title,description,status,priority,branch,x,y,images,dependencies})=>['n:'+id,JSON.stringify([title,description,status,priority,branch,x,y,images,dependencies])] as const),...(board.canvas?.items||[]).map(item=>['i:'+item.id,JSON.stringify(item)] as const)]);
 const a=snapshots(before),b=snapshots(after);return [...new Set([...new Set([...a.keys(),...b.keys()])].filter(id=>a.get(id)!==b.get(id)).map(id=>id.slice(2)))];
}
