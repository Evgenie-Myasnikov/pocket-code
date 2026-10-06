import type {Root,Element,Text,RootContent} from 'hast';
export type RevealRange={start:number;end:number;at:number};
export type RevealOptions={ranges:RevealRange[];now:number};
export const revealLifetime=560;
export const revealCharacterLimit=192;
const segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});

/** Decorate only a bounded, newly received tail; Markdown and copyable text stay intact. */
export function rehypeStreamingReveal({ranges,now}:RevealOptions){
  return (tree:Root)=>{
    let remaining=revealCharacterLimit;
    const first=ranges[0]?.start??Infinity;
    function visit(parent:Root|Element){
      if(parent.type==='element'&&['pre','code','svg','math'].includes(parent.tagName))return;
      const children:RootContent[]=[];
      for(const child of parent.children){
        if(child.type==='element'){visit(child);children.push(child);continue;}
        const start=child.position?.start.offset,end=child.position?.end.offset;
        // Escapes/entities can change source offsets; leave those nodes intact.
        if(child.type!=='text'||start===undefined||end===undefined||end<=first||end-start!==child.value.length||!remaining){children.push(child);continue;}
        const boundary=segmenter.segment(child.value).containing(Math.max(0,first-start))?.index??0;
        let plain=child.value.slice(0,boundary);
        const flush=()=>{if(plain){children.push({type:'text',value:plain} as Text);plain='';}};
        for(const {segment,index} of segmenter.segment(child.value.slice(boundary))){
          if(!remaining){plain+=child.value.slice(boundary+index);break;}
          const offset=start+boundary+index,range=ranges.find(item=>offset>=item.start&&offset<item.end&&now-item.at<revealLifetime);
          if(!range||!remaining||/^\s+$/u.test(segment)){plain+=segment;continue;}
          flush();remaining--;
          const delay=Math.min(120,(offset-range.start)*4)-(now-range.at);
          children.push({type:'element',tagName:'span',properties:{className:['stream-glyph'],'data-stream-offset':offset,style:`animation-delay:${delay}ms`},children:[{type:'text',value:segment}]});
        }
        flush();
      }
      parent.children=children;
    }
    visit(tree);
  };
}
