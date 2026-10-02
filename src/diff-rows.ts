export type DiffRow={left?:string;right?:string;old?:number;next?:number;kind:'context'|'change'|'hunk'};
export function diffRows(patch:string):DiffRow[]{
  const rows:DiffRow[]=[];let old=0,next=0,removed:{text:string;line:number}[]=[],added:{text:string;line:number}[]=[];
  const flush=()=>{for(let i=0;i<Math.max(removed.length,added.length);i++)rows.push({kind:'change',left:removed[i]?.text,old:removed[i]?.line,right:added[i]?.text,next:added[i]?.line});removed=[];added=[];};
  for(const line of patch.split(/\r?\n/)){
    if(line.startsWith('@@')){flush();const match=line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);if(match){old=Number(match[1]);next=Number(match[2]);rows.push({kind:'hunk',left:line});}continue;}
    if(!old&&!next)continue;
    if(line.startsWith('-'))removed.push({text:line.slice(1),line:old++});
    else if(line.startsWith('+'))added.push({text:line.slice(1),line:next++});
    else if(line.startsWith(' ')){flush();rows.push({kind:'context',left:line.slice(1),right:line.slice(1),old:old++,next:next++});}
  }flush();return rows;
}

/** Keep each deletion block before its replacement block, as in a unified patch. */
export function inlineDiffRows(rows:DiffRow[]):(DiffRow&{sign?:string})[]{
  const result:(DiffRow&{sign?:string})[]=[];let changes:DiffRow[]=[];
  const flush=()=>{for(const row of changes)if(row.left!==undefined)result.push({kind:'change',left:row.left,old:row.old,sign:'-'});for(const row of changes)if(row.right!==undefined)result.push({kind:'change',right:row.right,next:row.next,sign:'+'});changes=[];};
  for(const row of rows){if(row.kind==='change')changes.push(row);else{flush();result.push(row);}}flush();return result;
}

/** A wholly new/deleted file has no opposite side; insertions in existing files do. */
export function singleDiffSide(patch:string,rows:DiffRow[]):'added'|'removed'|null{
  const content=rows.filter(row=>row.kind!=='hunk');if(!content.length)return null;
  if(/^@@ -0,0 \+1(?:,\d+)? @@/m.test(patch)&&content.every(row=>row.old===undefined))return 'added';
  if(/^@@ -1(?:,\d+)? \+0,0 @@/m.test(patch)&&content.every(row=>row.next===undefined))return 'removed';
  return null;
}
