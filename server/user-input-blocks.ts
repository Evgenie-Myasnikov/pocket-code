import type {Block} from './types.js';
/** Display metadata only; the original prompt and provider attachments stay unchanged. */
export function userInputBlocks(input:{text:string;displayText?:string;attachmentPaths?:string[]}):Block[]{
  return [{type:'text',text:input.displayText??input.text},...(input.attachmentPaths||[]).map(attachmentPath=>({type:'attachment',attachmentPath}))];
}
