import type {BoardEditActivity} from '../server/board-live';
export type BoardWriteReceipt=Pick<BoardEditActivity,'id'|'ids'|'action'>;
/** Keep the latest confirmed write separate from cursor events, which may combine reads. */
export function latestBoardWrite(events:BoardEditActivity[],seen:ReadonlySet<string>,now=Date.now()):BoardWriteReceipt|null{
 const saved=events.filter(event=>event.phase==='saved'&&event.action!=='inspect'&&event.expiresAt>now&&!seen.has(event.id)&&event.ids.length).at(-1);
 return saved?{id:saved.id,ids:[...new Set(saved.ids)],action:saved.action}:null;
}
