import path from 'node:path';
import {allowedPath,HttpError,within} from './security.js';
import {projectArtifact} from './project-artifact.js';
/** Paired-PC clients only. Internal upload state directories are never previewable. */
export async function messageAttachment(project:string,uploads:string,input:string){
  const file=path.resolve(project,input);
  if(within(project,file))return projectArtifact(project,file);
  const relative=path.relative(uploads,file),parts=relative.split(path.sep);
  if(parts.length!==2||! /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(parts[0])||parts[1].startsWith('.'))throw new HttpError(403,'Attachment is outside permitted folders');
  await allowedPath([uploads],file);
  return projectArtifact(path.join(uploads,parts[0]),file);
}
