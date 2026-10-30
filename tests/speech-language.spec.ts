import {test,expect} from '@playwright/test';
test('read-aloud chooses Russian voice, waits for voices and cancels pending speech',async({page})=>{
 await page.goto('http://127.0.0.1:5173');const result=await page.evaluate(async()=>{
 Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class extends EventTarget{lang='';voice:any=null;constructor(public text:string){super();}}});const {LocalSpeechSynthesisAdapter}=await import('/src/speech-synthesis.ts' as string);const calls:any[]=[];let voices:any[]=[{lang:'en-US',localService:true,name:'English'},{lang:'ru-RU',localService:true,name:'Russian'}];
 const synth=Object.assign(new EventTarget(),{getVoices:()=>voices,speak:(u:any)=>calls.push({lang:u.lang,voice:u.voice?.name}),cancel:()=>{}});Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});
 const adapter=new LocalSpeechSynthesisAdapter('en-US');adapter.speak('\u041f\u0440\u0438\u0432\u0435\u0442');adapter.speak('Hello');voices=[];const pending=adapter.speak('\u0420\u0443\u0441\u0441\u043a\u0438\u0439');const before=calls.length;voices=[{lang:'ru-RU',localService:true,name:'Russian'}];synth.dispatchEvent(new Event('voiceschanged'));voices=[];const cancelled=adapter.speak('\u041d\u0435 \u0447\u0438\u0442\u0430\u0442\u044c');cancelled.cancel();voices=[{lang:'ru-RU',name:'Russian'}];synth.dispatchEvent(new Event('voiceschanged'));return {calls,before,pending:pending.status,cancelled:cancelled.status};
 });
 expect(result.calls).toEqual([{lang:'ru-RU',voice:'Russian'},{lang:'en-US',voice:'English'},{lang:'ru-RU',voice:'Russian'}]);expect(result.before).toBe(2);expect(result.pending.type).toBe('running');expect(result.cancelled).toMatchObject({type:'ended',reason:'cancelled'});
});
