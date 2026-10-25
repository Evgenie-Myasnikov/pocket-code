import path from 'node:path';
import {createApp} from '../server/app';
import {Jobs} from '../server/jobs';
const [root,data]=process.argv.slice(2),token=process.env.BOARD_VIEW_TEST_TOKEN!;
if(!root||!data||!token)throw Error('Synthetic test configuration required');
const jobs=new Jobs(),{app,closeTaskServices}=await createApp({token,hostName:'Synthetic PC',roots:[root],uploads:path.join(data,'uploads'),desktopSessionIndexes:[]},jobs,{listSessions:async()=>[],getSessionMessages:async()=>[]} as any);
const host=app.listen(0,'127.0.0.1');await new Promise<void>(r=>host.once('listening',r));process.stdout.write(JSON.stringify({port:(host.address() as any).port})+'\n');
process.stdin.resume();process.stdin.once('end',async()=>{jobs.close();await new Promise<void>(r=>host.close(()=>r()));await closeTaskServices?.();});
