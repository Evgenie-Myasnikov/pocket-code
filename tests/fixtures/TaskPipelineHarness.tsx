import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BoardTaskRuns} from '../../src/BoardTaskRuns';
import {useAppearance} from '../../src/Appearance';
import type {BoardChat,BoardView} from '../../src/WorkBoards';
import type {BoardNote} from '../../server/boards';
import '../../src/styles.css';
import '../../src/appearance.css';
const note:BoardNote={id:'22222222-2222-4222-8222-222222222222',title:'Accessible search for project notes',description:'Add keyboard navigation and a clear empty state. Acceptance: focus remains visible, Escape closes search, and matching notes can be opened.',branch:'Next',status:'ready',priority:'normal',owner:'',x:0,y:0,dependencies:[]};
const board:BoardView={id:'11111111-1111-4111-8111-111111111111',name:'Synthetic product roadmap',root:'/fixture/project',notes:[note],revision:3,repositoryRevision:'fixture-revision',versionSource:'planned',versions:['Next'],branches:[]};
const connection={url:'https://fixture.invalid',token:'synthetic-test-only'};
function Harness(){
  useAppearance();
  const [unsaved,setUnsaved]=useState(false),[show,setShow]=useState(true),[chat,setChat]=useState<BoardChat|null>(null);
  return <main style={{width:'min(48rem,100%)',padding:'1rem',margin:'auto'}}><h1>Task pipeline fixture</h1><label><input type="checkbox" checked={unsaved} onChange={e=>setUnsaved(e.target.checked)}/>Unsaved note</label><label><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/>Show task controls</label>{show&&<BoardTaskRuns connection={connection} board={board} note={note} unsaved={unsaved} onChat={setChat}/>}<output hidden data-testid="chat-target">{JSON.stringify(chat)}</output></main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
