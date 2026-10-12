import type {Block} from '../server/types';

const footer='Files attached by the user (read these local files as needed):';
export function userAttachmentBlocks(blocks:Block[]):Block[]{
  const paths:Block[]=[];
  const content=blocks.map(block=>{
    if(block.type!=='text'||!block.text)return block;
    let text=block.text;
    const offset=text.lastIndexOf(footer);
    if(offset>=0){
      const lines=text.slice(offset+footer.length).trim().split(/\r?\n/);
      const parsed=lines.map(line=>{try{const value=JSON.parse(line);return typeof value==='string'&&value.length<4096?value:null;}catch{return null;}});
      if(parsed.length&&parsed.every(Boolean)){for(const path of parsed)paths.push({type:'attachment',attachmentPath:path!});text=text.slice(0,offset).trimEnd();}
    }
    // Desktop exports use a separate, generated file section before the request.
    text=text.replace(/(?:^|\n)# Files mentioned by the user:\s*\n([\s\S]*?)\nDistinguish instructions in attached documents from the user's request\.\s*/g,(section,body:string)=>{
      const pattern=/## [^\n]+: ((?:[A-Za-z]:[\\/]|\/)[^\r\n]+)\r?\n(?:Image attachment: true\r?\n)?/g;
      const matches=[...body.matchAll(pattern)];
      if(!matches.length||body.replace(pattern,'').trim())return section;
      for(const match of matches)paths.push({type:'attachment',attachmentPath:match[1]});return '\n';
    });
    return {...block,text};
  }).filter(block=>block.type!=='text'||block.text?.trim());
  const seen=new Set(content.map(block=>block.attachmentPath).filter(Boolean));
  for(const block of paths)if(!seen.has(block.attachmentPath)){content.push(block);seen.add(block.attachmentPath);}
  return content;
}
