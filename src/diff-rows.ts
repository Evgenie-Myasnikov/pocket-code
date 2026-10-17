export type Range=[number,number];
export type DiffRow={left?:string;right?:string;old?:number;next?:number;kind:'context'|'change'|'hunk';leftRanges?:Range[];rightRanges?:Range[]};
export type InlineRow=DiffRow&{sign?:string;ranges?:Range[]};

const tokens=(text:string)=>text.match(/\w+|\s+|[^\w\s]/gu)||[];
/** Changed character ranges inside a replaced line pair (token LCS), or none when the lines are too long or too different to compare usefully. */
export function wordRanges(before:string,after:string):{left:Range[];right:Range[]}|null{
  if(before===after||before.length>500||after.length>500)return null;
  const a=tokens(before),b=tokens(after);
  if(!a.length||!b.length||a.length*b.length>40_000)return null;
  // LCS table from the end, so the walk below goes forward.
  const width=b.length+1,table=new Uint16Array((a.length+1)*width);
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i*width+j]=a[i]===b[j]?table[(i+1)*width+j+1]+1:Math.max(table[(i+1)*width+j],table[i*width+j+1]);
  const left:Range[]=[],right:Range[]=[];let i=0,j=0,x=0,y=0,common=0;
  const add=(list:Range[],start:number,end:number)=>{const last=list.at(-1);if(last&&last[1]===start)last[1]=end;else list.push([start,end]);};
  while(i<a.length||j<b.length){
    if(i<a.length&&j<b.length&&a[i]===b[j]){common+=a[i].length;x+=a[i++].length;y+=b[j++].length;}
    else if(j<b.length&&(i>=a.length||table[i*width+j+1]>=table[(i+1)*width+j])){add(right,y,y+b[j].length);y+=b[j++].length;}
    else{add(left,x,x+a[i].length);x+=a[i++].length;}
  }
  // Below about half shared text, a highlight is noise: the whole line changed.
  if(2*common/(before.length+after.length)<.5)return null;
  return {left,right};
}

export function diffRows(patch:string):DiffRow[]{
  const rows:DiffRow[]=[];let old=0,next=0,removed:{text:string;line:number}[]=[],added:{text:string;line:number}[]=[];
  const flush=()=>{for(let i=0;i<Math.max(removed.length,added.length);i++){const row:DiffRow={kind:'change',left:removed[i]?.text,old:removed[i]?.line,right:added[i]?.text,next:added[i]?.line};if(row.left!==undefined&&row.right!==undefined){const ranges=wordRanges(row.left,row.right);if(ranges){row.leftRanges=ranges.left;row.rightRanges=ranges.right;}}rows.push(row);}removed=[];added=[];};
  for(const line of patch.split(/\r?\n/)){
    if(line.startsWith('@@')){flush();const match=line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);if(match){old=Number(match[1]);next=Number(match[2]);rows.push({kind:'hunk',left:line});}continue;}
    if(!old&&!next)continue;
    if(line.startsWith('-'))removed.push({text:line.slice(1),line:old++});
    else if(line.startsWith('+'))added.push({text:line.slice(1),line:next++});
    else if(line.startsWith(' ')){flush();rows.push({kind:'context',left:line.slice(1),right:line.slice(1),old:old++,next:next++});}
  }flush();return rows;
}

/** Keep each deletion block before its replacement block, as in a unified patch. */
export function inlineDiffRows(rows:DiffRow[]):InlineRow[]{
  const result:InlineRow[]=[];let changes:DiffRow[]=[];
  const flush=()=>{for(const row of changes)if(row.left!==undefined)result.push({kind:'change',left:row.left,old:row.old,sign:'-',ranges:row.leftRanges});for(const row of changes)if(row.right!==undefined)result.push({kind:'change',right:row.right,next:row.next,sign:'+',ranges:row.rightRanges});changes=[];};
  for(const row of rows){if(row.kind==='change')changes.push(row);else{flush();result.push(row);}}flush();return result;
}

/** A wholly new/deleted file has no opposite side; insertions in existing files do. */
export function singleDiffSide(patch:string,rows:DiffRow[]):'added'|'removed'|null{
  const content=rows.filter(row=>row.kind!=='hunk');if(!content.length)return null;
  if(/^@@ -0,0 \+1(?:,\d+)? @@/m.test(patch)&&content.every(row=>row.old===undefined))return 'added';
  if(/^@@ -1(?:,\d+)? \+0,0 @@/m.test(patch)&&content.every(row=>row.next===undefined))return 'removed';
  return null;
}

/** "@@ -14,14 +16,17 @@ type Props" → the new line range and the enclosing function Git reported. */
export function hunkLabel(header:string):{start:number;end:number;context:string}|null{
  const match=header.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@ ?(.*)$/);if(!match)return null;
  const start=Number(match[1]),count=match[2]===undefined?1:Number(match[2]);
  return {start,end:Math.max(start,start+count-1),context:match[3].trim()};
}
