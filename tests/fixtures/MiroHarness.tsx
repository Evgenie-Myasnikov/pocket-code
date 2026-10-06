import {MiroSettings} from '../../src/MiroSettings';
const connection={url:'http://127.0.0.1:4319',token:'synthetic-token'};
export function MiroHarness(){return <main style={{maxWidth:700,padding:20,margin:'auto'}}><MiroSettings connection={connection} roots={['C:\\Synthetic\\Atlas','C:\\Synthetic\\Other']}/></main>;}
