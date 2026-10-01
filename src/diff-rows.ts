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
