import {z} from 'zod';
import {lstat,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {HttpError} from './security.js';

export const boardImage=z.object({path:z.string().regex(/^project-boards\/assets\/[a-f0-9]{64}\.(png|jpg|webp)$/),caption:z.string().max(160)}).strict();
export const boardImages=z.array(boardImage).max(12).optional();
const limit=10*1024*1024;
function imageType(bytes:Buffer){
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {extension:'png',mimeType:'image/png'};
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {extension:'jpg',mimeType:'image/jpeg'};
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return {extension:'webp',mimeType:'image/webp'};
 throw new HttpError(415,'Use a PNG, JPEG or WebP image');
}
async function assetDirectory(root:string,create:boolean){
 let folder=root;
 for(const part of ['project-boards','assets']){
  folder=path.join(folder,part);
  if(create)await mkdir(folder).catch(e=>{if(e.code!=='EEXIST')throw e;});
  const info=await lstat(folder);
  if(info.isSymbolicLink()||!info.isDirectory())throw new HttpError(403,'Linked image directories are not allowed');
 }
 return folder;
}
export async function saveBoardImage(root:string,data:string,caption:string){
 if(data.length>Math.ceil(limit/3)*4)throw new HttpError(413,'Images must be 10 MB or smaller');
 if(!data||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw new HttpError(400,'Invalid image encoding');
 const bytes=Buffer.from(data,'base64');if(bytes.toString('base64')!==data)throw new HttpError(400,'Invalid image encoding');if(bytes.length>limit)throw new HttpError(413,'Images must be 10 MB or smaller');
 const type=imageType(bytes),hash=createHash('sha256').update(bytes).digest('hex');
 const image=boardImage.parse({path:`project-boards/assets/${hash}.${type.extension}`,caption});
 const target=path.join(await assetDirectory(root,true),path.basename(image.path));
 try{await writeFile(target,bytes,{flag:'wx',mode:0o600});}catch(e:any){
  if(e.code!=='EEXIST')throw e;
  const info=await lstat(target);if(info.isSymbolicLink()||!info.isFile()||info.size!==bytes.length)throw new HttpError(403,'Invalid existing image');
  if(createHash('sha256').update(await readFile(target)).digest('hex')!==hash)throw new HttpError(409,'Stored image content changed');
 }
 return image;
}
export async function readBoardImage(root:string,input:string){
 const image=boardImage.parse({path:input,caption:''}),directory=await assetDirectory(root,false),target=path.join(directory,path.basename(image.path));
 const info=await lstat(target);if(info.isSymbolicLink()||!info.isFile())throw new HttpError(403,'Invalid image file');
 if(info.size>limit)throw new HttpError(413,'Images must be 10 MB or smaller');
 const bytes=await readFile(target),type=imageType(bytes);
 if(bytes.length>limit||createHash('sha256').update(bytes).digest('hex')!==path.basename(target).split('.')[0])throw new HttpError(409,'Stored image content changed');
 return {mimeType:type.mimeType,data:bytes.toString('base64')};
}
