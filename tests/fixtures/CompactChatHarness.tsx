import {MessageList} from '../../src/Messages';
import {ChatHeader} from '../../src/ChatHeader';
const connection={url:'http://127.0.0.1:4319',token:'synthetic'};
export function CompactChatHarness(){
 return <main className="app show-chat"><section className="workspace"><ChatHeader title="Design review" project="Example" provider="Claude" onBack={()=>{}}/><div className="conversation"><div className="conversation-inner"><MessageList connection={connection} cwd="C:/Synthetic" messages={[{id:'user',role:'user',blocks:[{type:'text',text:'Please review the diagram.\n\nFiles attached by the user (read these local files as needed):\n"C:/Synthetic/diagram.png"\n"C:/Synthetic/notes.md"'}]},{id:'answer',role:'assistant',blocks:[{type:'text',text:'The attachment remains available from the message.\n\n'.repeat(18)}]}]}/></div></div><div className="composer-area">Write a message…</div></section></main>;
}
