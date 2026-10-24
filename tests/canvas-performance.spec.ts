import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
test('large canvas drag profile',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:5173/tests/whiteboard-fixture.html?stress');await expect(page.locator('.whiteboard-item')).toHaveCount(400);
 const node=page.locator('.whiteboard-text').first(),r=(await node.boundingBox())!;await page.mouse.move(r.x+100,r.y+60);
 await page.evaluate(()=>{(window as any).canvasCommits=[];(window as any).cardRenders=0;});const started=Date.now();
 await page.mouse.down();await page.mouse.move(r.x+280,r.y+160,{steps:30});await page.mouse.up();
 const sample=await page.evaluate(()=>({commits:(window as any).canvasCommits,renders:(window as any).cardRenders}));const times=sample.commits.map((c:any)=>c.duration).sort((a:number,b:number)=>a-b);
 const result={wallMs:Date.now()-started,commits:times.length,totalRenderMs:times.reduce((a:number,b:number)=>a+b,0),p95RenderMs:times[Math.floor(times.length*.95)]||0,cardMetadataRenders:sample.renders};expect(result.cardMetadataRenders).toBeLessThanOrEqual(800);console.log(JSON.stringify(result));writeFileSync(process.env.CANVAS_PROFILE_PATH||'.local/canvas-profile.json',JSON.stringify(result,null,2));
});
