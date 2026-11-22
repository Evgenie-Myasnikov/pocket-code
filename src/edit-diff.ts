type Input=Record<string,unknown>;
export type EditLine={kind:'context'|'add'|'del'|'meta';text:string};
export type EditFile={path:string;lines:EditLine[];counted:boolean;content?:string};
const string=(value:unknown)=>typeof value==='string'?value:'';
const fields=(value:unknown):Input=>value&&typeof value==='object'&&!Array.isArray(value)?value as Input:{};
const newFile=(path:string):EditFile=>({path,lines:[],counted:true});
// A final newline terminates the last line. An additional newline represents a blank line.
const split=(content:string)=>content.replace(/\r\n/g,'\n').match(/[^\n]*\n|[^\n]+$/g)||[];
function line(file:EditFile,kind:EditLine['kind'],text:string){file.lines.push({kind,text:text.replace(/\n$/,'')});}

function replacement(file:EditFile,before:string,after:string){
  const a=split(before),b=split(after);
  let start=0,end=0;
  while(start<a.length&&start<b.length&&a[start]===b[start]){line(file,'context',a[start]);start++;}
  while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++;
  const height=a.length-start-end,width=b.length-start-end;
  // Bound the work on unrelated large blocks. The two versions remain readable without estimated counts.
  if(height&&width&&height*width>500_000){
    file.counted=false;
    for(const text of a.slice(start,a.length-end))line(file,'del',text);
    for(const text of b.slice(start,b.length-end))line(file,'add',text);
  }else{
    const stride=width+1,table=new Uint32Array((height+1)*stride);
    for(let i=height-1;i>=0;i--)for(let j=width-1;j>=0;j--){
      const cell=i*stride+j;
      table[cell]=a[start+i]===b[start+j]?table[cell+stride+1]+1:Math.max(table[cell+stride],table[cell+1]);
    }
    let i=0,j=0;
    while(i<height||j<width){
      if(i<height&&j<width&&a[start+i]===b[start+j]){line(file,'context',a[start+i++]);j++;}
      else if(i<height&&(j===width||table[(i+1)*stride+j]>=table[i*stride+j+1]))line(file,'del',a[start+i++]);
      else line(file,'add',b[start+j++]);
    }
  }
  for(const text of a.slice(a.length-end))line(file,'context',text);
}

function patchFiles(patch:string,path:string):EditFile[]{
  const files:EditFile[]=[],raw=split(patch).map(text=>text.replace(/\n$/,''));
  let file:EditFile|undefined,oldLeft=0,newLeft=0;
  const start=(name:string)=>{file=newFile(name);files.push(file);oldLeft=0;newLeft=0;return file;};
  for(let index=0;index<raw.length;index++){
    const s=raw[index],marker=s.match(/^\*\*\* (Add|Delete|Update) File: (.+)$/);
    if(marker){const next=start(marker[2]);if(marker[1]==='Delete')next.counted=false;continue;}
    if(/^\*\*\* (Begin Patch|End Patch|End of File)$/.test(s))continue;
    if(s.startsWith('diff --git ')){file=undefined;oldLeft=0;newLeft=0;continue;}
    if(s.startsWith('*** Move to: ')&&file){file.path+=' → '+s.slice(13);continue;}
    if(oldLeft<=0&&newLeft<=0&&s.startsWith('--- ')&&raw[index+1]?.startsWith('+++ ')){
      const oldPath=s.slice(4).split('\t')[0].replace(/^a\//,''),next=raw[++index].slice(4).split('\t')[0].replace(/^b\//,'');
      start(next==='/dev/null'?oldPath:next);continue;
    }
    // Git extended headers appear before its pair of file paths.
    if(!file&&/^(index |new file mode |deleted file mode |old mode |new mode |similarity index )/.test(s))continue;
    const current=file||start(path);
    if(s.startsWith('@@')){
      const hunk=s.match(/^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/);
      oldLeft=hunk?Number(hunk[1]??1):0;newLeft=hunk?Number(hunk[2]??1):0;line(current,'meta',s);
    }else if(s[0]==='+'){line(current,'add',s.slice(1));newLeft--;}
    else if(s[0]==='-'){line(current,'del',s.slice(1));oldLeft--;}
    else if(s[0]===' '){line(current,'context',s.slice(1));oldLeft--;newLeft--;}
    else line(current,'meta',s);
  }
  return files;
}

export function editFiles(input:Input,name:string,created=false):EditFile[]{
  const path=string(input.file_path)||string(input.path)||string(input.notebook_path);
  if(Array.isArray(input.changes))return input.changes.flatMap(value=>{
    const change=fields(value),file=newFile(string(change.path)),kind=string(fields(change.kind).type)||string(change.kind);
    const diff=string(change.diff);
    if(!diff){file.counted=false;return [file];}
    if((kind==='add'||kind==='delete')&&!/^(?:@@|diff --git |--- |\*\*\* Begin Patch)/m.test(diff)){
      for(const text of split(diff))line(file,kind==='add'?'add':'del',text);
      return [file];
    }
    return patchFiles(diff,file.path);
  });
  const patch=string(input.patch)||string(input.input)||(name==='apply_patch'?string(input.content):'');
  if(patch)return patchFiles(patch,path);
  const file=newFile(path);
  const edits=Array.isArray(input.edits)?input.edits.map(fields):[input];
  if(edits.some(edit=>'old_string' in edit||'old_str' in edit)){
    for(const edit of edits){
      if(file.lines.length)line(file,'meta','@@');
      replacement(file,string(edit.old_string??edit.old_str),string(edit.new_string??edit.new_str));
      if(edit.replace_all===true||input.replace_all===true)file.counted=false;
    }
  }else if(typeof input.content==='string'||typeof input.file_text==='string'||typeof input.new_source==='string'||typeof input.new_string==='string'||typeof input.new_str==='string'){
    file.content=string(input.content??input.file_text??input.new_source??input.new_string??input.new_str);
    file.counted=created||name==='create'||input.command==='create'||input.command==='insert'||name==='insert';
    for(const text of split(file.content))line(file,file.counted?'add':'context',text);
  }else file.counted=false;
  return [file];
}
