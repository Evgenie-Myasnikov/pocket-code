export type ProjectFolder = {
  name:string;
  parent?:ProjectFolder;
  children:Map<string,ProjectFolder>;
  project?:string;
};

function pathParts(path:string){
  const unc=/^(?:\\\\|\/\/)([^\\/]+)[\\/]+(.*)$/.exec(path);
  if(unc)return {windows:true,parts:['\\\\'+unc[1],...unc[2].split(/[\\/]+/).filter(Boolean)]};
  if(/^[A-Za-z]:(?:[\\/]|$)/.test(path)){
    return {windows:true,parts:[path.slice(0,2)+'\\',...path.slice(2).split(/[\\/]+/).filter(Boolean)]};
  }
  return {windows:false,parts:[...(path.startsWith('/')?['/']:[]),...path.split('/').filter(Boolean)]};
}

export function projectFolderTree(paths:readonly string[]){
  const root:ProjectFolder={name:'',children:new Map()};
  const projects:ProjectFolder[]=[];
  for(const path of paths){
    if(!path)continue;
    const {windows,parts}=pathParts(path);
    let node=root;
    for(const name of parts){
      const key=windows?name.toLowerCase():name;
      let next=node.children.get(key);
      if(!next){
        next={name,parent:node,children:new Map()};
        node.children.set(key,next);
      }
      node=next;
    }
    if(!node.project&&node!==root){node.project=path;projects.push(node);}
  }
  let start=root;
  while(start.children.size===1&&!start.project){
    const only=start.children.values().next().value!;
    if(!only.children.size)break;
    start=only;
  }
  return {root,start,projects};
}

export function filterProjectFolders(projects:ProjectFolder[],query:string,displayName?:(path:string)=>string|undefined){
  const needle=query.trim().toLowerCase();
  return projects.filter(({project:path})=>path&&(
    path.toLowerCase().includes(needle)||
    (pathParts(path).windows&&path.toLowerCase().replaceAll('\\','/').includes(needle.replaceAll('\\','/')))||
    displayName?.(path)?.toLowerCase().includes(needle)
  ));
}
