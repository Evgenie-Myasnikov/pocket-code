export type MiroLink={boardId:string;url:string;embedUrl:string};
/** Retain only a board ID, never invitation tokens, credentials or tracking parameters. */
export function miroLink(value:string):MiroLink{
  let url:URL;try{url=new URL(value.trim());}catch{throw Error('Use a Miro board link: https://miro.com/app/board/…');}
  const match=url.pathname.match(/^\/app\/(?:board|live-embed)\/([A-Za-z0-9_=-]{5,100})\/?$/);
  if(url.protocol!=='https:'||url.hostname!=='miro.com'||url.port||url.username||url.password||!match)throw Error('Use a Miro board link: https://miro.com/app/board/…');
  const boardId=match[1];
  return {boardId,url:`https://miro.com/app/board/${boardId}/`,embedUrl:`https://miro.com/app/live-embed/${boardId}/?autoplay=true&usePostAuth=true`};
}
