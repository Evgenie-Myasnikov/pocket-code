// Mermaid flowchart subset -> board canvas layout. Pure functions: no I/O, no board access.
// Supported: `flowchart|graph TD|TB|BT|LR|RL`, nodes `A`, `A[text]`, `A(text)`, `A{text}`, `A((text))`,
// `A[[text]]`, `A([text])`, `A[(text)]`, `A{{text}}`, `A>text]`, chained edges `A --> B --> C`,
// edge kinds `-->` `==>` (arrow), `---` (line), `-.->` `-.-` (dashed), labels `-->|text|` or `-- text -->`.
// Subgraphs, classes, styles and click handlers are ignored; other syntax fails with its line number.

export const DIAGRAM_LIMITS={nodes:60,edges:120,source:20000};
const shapes=[['((','))'],['[[',']]'],['([','])'],['[(',')]'],['{{','}}'],['[',']'],['(',')'],['{','}'],['>',']']];
const ignored=/^(subgraph|end|classDef|class|style|linkStyle|click|direction)\b/i;
const edges=[
 [/^-->\|([^|]*)\|/,'arrow'],[/^==>\|([^|]*)\|/,'arrow'],[/^---\|([^|]*)\|/,'line'],[/^-\.->\|([^|]*)\|/,'dashed'],[/^-\.-\|([^|]*)\|/,'dashed'],
 [/^--\s+([^\s-][^>]*?)\s+-->/,'arrow'],[/^==\s+([^\s=][^>]*?)\s+==>/,'arrow'],[/^-\.\s+(.+?)\s+\.->/,'dashed'],
 [/^-\.->/,'dashed'],[/^-\.-/,'dashed'],[/^==>/,'arrow'],[/^-->/,'arrow'],[/^---/,'line'],
];
const clean=text=>text.trim().replace(/^"(.*)"$/s,'$1').replace(/<br\s*\/?>/gi,'\n').trim();

export class DiagramError extends Error{constructor(message){super(message);this.name='DiagramError';}}

function readNode(line,at,number){
 const id=/^[A-Za-z_][\w-]*/.exec(line.slice(at));if(!id)throw new DiagramError(`Line ${number}: expected a node ID`);
 let pos=at+id[0].length,label;
 for(const [open,close] of shapes){
  if(!line.startsWith(open,pos))continue;
  const end=line.indexOf(close,pos+open.length);if(end<0)throw new DiagramError(`Line ${number}: missing "${close}" after node ${id[0]}`);
  label=clean(line.slice(pos+open.length,end));pos=end+close.length;break;
 }
 return {id:id[0],label,pos};
}

/** Parse a Mermaid flowchart into nodes (declaration order) and edges. */
export function parseFlowchart(source){
 if(typeof source!=='string'||!source.trim())throw new DiagramError('Diagram source is empty');
 if(source.length>DIAGRAM_LIMITS.source)throw new DiagramError(`Diagram source exceeds ${DIAGRAM_LIMITS.source} characters`);
 const lines=source.split(/\r?\n/).map((text,index)=>({text:text.replace(/%%.*$/,'').trim(),number:index+1})).filter(line=>line.text);
 const header=lines.shift(),match=header&&/^(flowchart|graph)(?:\s+(TD|TB|BT|LR|RL))?\s*;?$/i.exec(header.text);
 if(!match)throw new DiagramError('Only Mermaid "flowchart" or "graph" diagrams are supported (for example: flowchart TD)');
 const direction=(match[2]||'TD').toUpperCase().replace('TB','TD');
 const nodes=new Map(),links=[];
 const node=(found)=>{const old=nodes.get(found.id);if(!old){if(nodes.size>=DIAGRAM_LIMITS.nodes)throw new DiagramError(`Diagrams are limited to ${DIAGRAM_LIMITS.nodes} nodes`);nodes.set(found.id,{id:found.id,label:found.label||found.id});}else if(found.label)old.label=found.label;return found.id;};
 for(const {text,number} of lines.flatMap(line=>line.text.split(';').map(part=>({text:part.trim(),number:line.number}))).filter(line=>line.text)){
  if(ignored.test(text))continue;
  let first=readNode(text,0,number),previous=node(first),pos=first.pos;
  while(pos<text.length){
   while(text[pos]===' '||text[pos]==='\t')pos++;if(pos>=text.length)break;
   const rest=text.slice(pos),edge=edges.map(([pattern,style])=>({found:pattern.exec(rest),style})).find(candidate=>candidate.found);
   if(!edge)throw new DiagramError(`Line ${number}: unsupported syntax near "${rest.slice(0,30)}"`);
   pos+=edge.found[0].length;while(text[pos]===' '||text[pos]==='\t')pos++;
   const next=readNode(text,pos,number),target=node(next);pos=next.pos;
   if(links.length>=DIAGRAM_LIMITS.edges)throw new DiagramError(`Diagrams are limited to ${DIAGRAM_LIMITS.edges} connections`);
   const label=edge.found[1]?clean(edge.found[1]):'';
   links.push({from:previous,to:target,style:edge.style,...(label?{label:label.slice(0,200)}:{})});previous=target;
  }
 }
 if(!nodes.size)throw new DiagramError('Diagram has no nodes');
 return {direction,nodes:[...nodes.values()],links};
}

/** Edges that close a cycle (found by DFS in declaration order); layering ignores them. */
function backEdges(graph){
 const out=new Map(graph.nodes.map(n=>[n.id,[]]));graph.links.forEach((l,i)=>out.get(l.from).push([l.to,i]));
 const state=new Map(),back=new Set();
 const visit=id=>{state.set(id,1);for(const [to,i] of out.get(id)){const s=state.get(to);if(s===1)back.add(i);else if(!s)visit(to);}state.set(id,2);};
 for(const n of graph.nodes)if(!state.get(n.id))visit(n.id);
 return back;
}
/** Layered layout: each node sits one level after its deepest predecessor, ignoring edges that close a cycle. */
export function layoutFlowchart(graph,{x=0,y=0,width=240,height=140,gapX=100,gapY=120,padding=80,header=90}={}){
 const level=new Map(graph.nodes.map(n=>[n.id,0])),back=backEdges(graph),forwardLinks=graph.links.filter((l,i)=>!back.has(i)&&l.from!==l.to);
 for(let pass=0;pass<graph.nodes.length;pass++){let changed=false;for(const l of forwardLinks){const next=level.get(l.from)+1;if(level.get(l.to)<next){level.set(l.to,next);changed=true;}}if(!changed)break;}
 const layers=[];for(const n of graph.nodes){const at=level.get(n.id);(layers[at]||=[]).push(n.id);}
 const rows=layers.filter(Boolean),horizontal=graph.direction==='LR'||graph.direction==='RL',reverse=graph.direction==='BT'||graph.direction==='RL';
 const widest=Math.max(...rows.map(r=>r.length));
 const across=index=>index*(horizontal?height+gapY:width+gapX),along=index=>index*(horizontal?width+gapX:height+gapY);
 const span=widest>0?across(widest-1)+(horizontal?height:width):0;
 const positions=new Map();
 rows.forEach((row,r)=>{const depth=reverse?rows.length-1-r:r,offset=(span-(across(row.length-1)+(horizontal?height:width)))/2;row.forEach((id,i)=>{const a=offset+across(i),b=along(depth);positions.set(id,horizontal?{x:x+padding+b,y:y+header+a}:{x:x+padding+a,y:y+header+b});});});
 const contentWidth=horizontal?along(rows.length-1)+width:span,contentHeight=horizontal?span:along(rows.length-1)+height;
 const sides={TD:['s','n'],BT:['n','s'],LR:['e','w'],RL:['w','e']}[graph.direction];
 return {positions,sides,frame:{x,y,width:Math.max(120,contentWidth+padding*2),height:Math.max(80,contentHeight+header+padding)},forward:l=>level.get(l.to)>level.get(l.from)};
}
