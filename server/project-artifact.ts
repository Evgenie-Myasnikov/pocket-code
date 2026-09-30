import path from 'node:path';
import {open} from 'node:fs/promises';
import {allowedPath,HttpError,within} from './security.js';

/** Explicit, authenticated previews. Never serves active HTML/SVG or follows network URLs. */
export async function projectArtifact(project:string,input:string) {
  if(/^[a-z][a-z\d+.-]*:/i.test(input)&&!(/^[a-z]:[\\/]/i.test(input)))throw new HttpError(400,'Select a local project file');
  const candidate=path.resolve(project,input);
  if(!within(project,candidate))throw new HttpError(403,'File is outside the selected project');
  const file=await allowedPath([project],candidate);
  const handle=await open(file,'r');
  try {
    const info=await handle.stat();
    if(!info.isFile())throw new HttpError(400,'Select a project file');
    const limit=10*1024*1024;
    if(info.size>limit)throw new HttpError(413,'Preview is available for files up to 10 MB');
    const buffer=Buffer.alloc(limit+1);const {bytesRead}=await handle.read(buffer,0,buffer.length,0);
    if(bytesRead>limit)throw new HttpError(413,'Preview is available for files up to 10 MB');
    const bytes=buffer.subarray(0,bytesRead),name=path.basename(file);
    const mimeType=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png'
      :bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg'
      :/^GIF8[79]a$/.test(bytes.subarray(0,6).toString())?'image/gif'
      :bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'image/webp'
      :bytes.subarray(0,5).toString()==='%PDF-'?'application/pdf':null;
    if(mimeType)return {name,mimeType,data:bytes.toString('base64')};
    if(bytes.length>1024*1024)throw new HttpError(413,'Text previews are available up to 1 MB');
    if(bytes.includes(0))throw new HttpError(415,'This file type cannot be previewed');
    let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new HttpError(415,'This file is not UTF-8 text');}
    return {name,mimeType:/\.md$/i.test(name)?'text/markdown':'text/plain',text};
  } finally {await handle.close();}
}
