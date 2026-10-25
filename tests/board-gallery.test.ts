import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boardGalleryImages,boardImageMime,startBoardImageDrag,takeBoardImageDrag} from '../src/board-image-drag';
import {boardSelectionContext,matchingBoardSelection} from '../src/board-selection-context';

const connection={url:'http://synthetic.invalid',token:'synthetic-key'},image={path:'project-boards/assets/'+'a'.repeat(64)+'.png',caption:'Synthetic image'};
function transfer(){const data=new Map<string,string>();return {data,setData:(type:string,value:string)=>data.set(type,value),getData:(type:string)=>data.get(type)||'',effectAllowed:''} as unknown as DataTransfer&{data:Map<string,string>};}
test('gallery deduplicates assets and drag data contains only a temporary opaque ID',()=>{
 assert.deepEqual(boardGalleryImages([{images:[image]},{images:[image]},{images:[]}]),[image]);assert.deepEqual(boardGalleryImages([]),[]);
 const data=transfer();startBoardImageDrag(data,connection,'synthetic-project',image);assert.equal(data.data.size,1);assert.match(data.getData(boardImageMime),/^[a-f0-9-]{36}$/);assert.equal(data.effectAllowed,'copy');assert.doesNotMatch(JSON.stringify([...data.data]),/synthetic-key|assets/);
 assert.deepEqual(takeBoardImageDrag(data,connection,'synthetic-project'),image);assert.equal(takeBoardImageDrag(data,connection,'synthetic-project'),null);
 for(const [other,root] of [[{...connection,token:'other-key'},'synthetic-project'],[connection,'other-project']] as const){startBoardImageDrag(data,connection,'synthetic-project',image);assert.equal(takeBoardImageDrag(data,other,root),null);}
});
test('selection context contains only selected product objects and follows board/account boundaries',()=>{
 const note=(id:string,title:string)=>({id,title,description:'Synthetic criteria',status:'idea',branch:'',dependencies:[],owner:'Synthetic private owner'});
 const board:any={id:'board',root:'synthetic-project',name:'Synthetic board',revision:1,versions:[],notes:[note('one','Selected card'),note('two','Other card')],canvas:{items:[],links:[]}};
 assert.equal(boardSelectionContext(connection,board,[]),null);assert.equal(boardSelectionContext(connection,board,['missing']),null);
 const selection=boardSelectionContext(connection,board,['one','one','missing'])!;assert.deepEqual(selection.ids,['one']);assert.match(selection.content,/Selected card/);assert.doesNotMatch(selection.content,/Other card|Synthetic private owner|synthetic-key/);
 assert.equal(matchingBoardSelection(selection,connection,board.root,board.id),selection);
 assert.equal(matchingBoardSelection(selection,{...connection,token:'other-key'},board.root,board.id),null);assert.equal(matchingBoardSelection(selection,connection,board.root,'other-board'),null);
});
