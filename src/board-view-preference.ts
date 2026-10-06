const key=(root:string,id:string)=>'pocket-board-view:'+root+':'+id;
export function boardView(root:string,id:string):'board'|'people' {
  try {return localStorage.getItem(key(root,id))==='people'?'people':'board';} catch {return 'board';}
}
export function saveBoardView(root:string,id:string,view:'board'|'people') {
  try {localStorage.setItem(key(root,id),view);} catch { /* Keep the in-memory view. */ }
}
