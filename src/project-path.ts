const windowsRoot=(path:string)=>/^(?:[A-Za-z]:[\\/]|\\\\)/.test(path);
export function projectRelative(root:string,absolute:string){
 const windows=windowsRoot(root),normalize=(p:string)=>windows?p.replaceAll('\\','/'):p;
 const base=normalize(root).replace(/\/+$/,''),target=normalize(absolute),key=(p:string)=>windows?p.toLowerCase():p;
 if(key(target.replace(/\/+$/,''))===key(base))return '';
 if(!key(target).startsWith(key(base+'/')))return undefined;
 const relative=target.slice(base.length+1);
 if(relative.split('/').some(part=>!part||part==='.'||part==='..'||/[\\\x00-\x1f]/.test(part)||windows&&/[:*?"<>|]/.test(part)))return undefined;
 return relative;
}
export function projectChild(root:string,relative:string){
 const separator=windowsRoot(root)&&root.includes('\\')?'\\':'/';
 return root.replace(/[\\/]+$/,'')+separator+relative.replaceAll('/',separator);
}
export function resultPath(root:string,file:string){
 if(!root||!(/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(root)))return undefined;
 const absolute=/^(?:[/\\]|[A-Za-z]:)/.test(file);
 return projectRelative(root,absolute?file:projectChild(root,file.replace(/^\.\//,'')))||undefined;
}
