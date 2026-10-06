import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {useChatOutputIndex} from '../../src/useChatOutputIndex';
function Harness(){const [session,setSession]=useState<string|undefined>('first');const result=useChatOutputIndex({url:'http://127.0.0.1:4319',token:'synthetic-test-token'},'claude',session,[]);return <><button onClick={()=>setSession('pending-new')}>New pending chat</button><button onClick={()=>setSession('second')}>Second chat</button><output>{JSON.stringify(result)}</output></>;}
export function mount(){const element=document.createElement('div');document.body.replaceChildren(element);createRoot(element).render(<Harness/>);}
