import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

/** A long synthetic transcript and a long Markdown file: dragging the side panel edge must stay within a frame. */
test('dragging the side panel edge over a long chat and a long file stays smooth',async({page})=>{
 await page.setViewportSize({width:1600,height:900});
 await page.addInitScript(()=>{
   const para=(i:number)=>`Paragraph ${i}: the renderer rebinds the views after a resize and the suite keeps its deadlines. `.repeat(4);
   const messages:any[]=[{id:'ask',role:'user',blocks:[{type:'text',text:'Review the project.'}]}];
   for(let i=0;i<120;i++){
     messages.push({id:'t'+i,role:'assistant',blocks:[{type:'tool_use',id:'c'+i,name:'Bash',input:{command:'powershell -File tools/Check-'+i+'.ps1'}}]});
     messages.push({id:'r'+i,role:'user',blocks:[{type:'tool_result',tool_use_id:'c'+i,content:'done'}]});
     messages.push({id:'a'+i,role:'assistant',blocks:[{type:'text',text:para(i)}]});
   }
   messages.push({id:'edit',role:'assistant',blocks:[{type:'tool_use',id:'change',name:'File changes',input:{status:'completed',changes:[{path:'CHANGELOG.md',kind:'update',diff:'@@\n-old\n+new'}]}}]});
   messages.push({id:'done',role:'assistant',blocks:[{type:'text',text:'Updated the changelog.'}]});
   (window as any).branchMessages=messages;
   (window as any).testFileTexts={'CHANGELOG.md':Array.from({length:300},(_,i)=>`## Version ${i}\n\n- ${para(i)}\n- ${para(i+1)}\n`).join('\n')};
 });
 await desktop(page);
 await page.getByRole('button',{name:/claude · Interface review/}).click();
 const card=page.getByRole('region',{name:'Turn result'});await card.getByRole('button',{name:/Files: 1/}).click();
 await card.getByRole('button',{name:'CHANGELOG.md'}).click();
 const panel=page.locator('.chat-side-panel');
 // a file from the turn result opens on its changes; the long file itself is the other view
 const whole=panel.getByRole('button',{name:'File',exact:true});if(await whole.count())await whole.click();
 await expect(panel).toContainText('Version 299');
 const edge=(await panel.getByRole('separator',{name:'Panel width'}).boundingBox())!;
 // Each step's main-thread time: the move event and the frame it causes.
 await page.evaluate(()=>{(window as any).frames_=[] as number[];let last=performance.now();const tick=(now:number)=>{(window as any).frames_.push(now-last);last=now;if((window as any).frames_.length<400)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 await page.mouse.move(edge.x+4,edge.y+400);await page.mouse.down();
 for(let i=0;i<40;i++)await page.mouse.move(edge.x+4-i*6,edge.y+400);
 await page.mouse.up();
 const frames:number[]=await page.evaluate(()=>(window as any).frames_.slice(2));
 const worst=Math.max(...frames),slow=frames.filter(f=>f>50).length;
 console.log('frames',frames.length,'worst',Math.round(worst),'over50',slow);
 expect(worst).toBeLessThan(90);expect(slow).toBeLessThanOrEqual(1);
});
