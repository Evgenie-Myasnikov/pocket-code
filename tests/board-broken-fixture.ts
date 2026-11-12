import {randomUUID} from 'node:crypto';
export const file='board-00000000-0000-4000-8000-000000000001.json';
const asset='project-boards/assets/'+'a'.repeat(64)+'.png';
export const paragraph=(index:number)=>`Entry ${index}: `+'synthetic validation record '.repeat(20).trim()+'.';
export const longText='Goal: keep the synthetic board readable.\n\n'+Array.from({length:60},(_,i)=>paragraph(i)).join('\n\n');
/** The three contract violations that kept a real board from opening: an over-long description, an over-long caption and an unknown priority. */
export function brokenBoard(){
 const good=randomUUID(),long=randomUUID(),caption=randomUUID(),priority=randomUUID(),sticky=randomUUID();
 const note=(id:string,title:string,extra:Record<string,unknown>={})=>({id,title,description:'Synthetic card',branch:'1.0',status:'ready',priority:'normal',x:100,y:100,dependencies:[],...extra});
 return {ids:{good,long,caption,priority,sticky},board:{format:'pocket-code-board',version:1,name:'Synthetic board',versions:['1.0'],
  notes:[note(good,'Healthy card'),note(long,'Long history',{description:longText}),note(caption,'Long caption',{images:[{path:asset,caption:'c'.repeat(170)}]}),note(priority,'Medium priority',{priority:'medium'})],
  canvas:{version:1,items:[{id:sticky,kind:'sticky',text:'Synthetic sticky',x:900,y:100,width:240,height:160,color:'mint'},{id:long,kind:'card',text:'Long history',description:longText,x:100,y:100,width:280,height:280,color:'sand'}],links:[{id:randomUUID(),from:sticky,to:long}]}}};
}
