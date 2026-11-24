import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';
test('action lines and answer text start at one edge, share one size and sit close together, as in Strata',async({page})=>{
 await page.addInitScript(()=>{
  (window as any).branchMessages=[
   {id:'ask',role:'user',blocks:[{type:'text',text:'Run the checks.'}]},
   {id:'a1',role:'assistant',blocks:[{type:'tool_use',id:'c1',name:'Bash',input:{command:'powershell -File tools/Run-ProbeSuite.ps1 -Backend d3d12'}}]},
   {id:'r1',role:'user',blocks:[{type:'tool_result',tool_use_id:'c1',content:'suite failed',is_error:true}]},
   {id:'a2',role:'assistant',blocks:[{type:'text',text:'P9-02 is committed (`cd07388`, 12 files, 758 tests green). Starting the next slice from my plan.'}]},
   {id:'a3',role:'assistant',blocks:[{type:'tool_use',id:'c2',name:'Read',input:{file_path:'src/a.ts'}},{type:'tool_use',id:'c3',name:'Read',input:{file_path:'src/b.ts'}}]},
   {id:'r3',role:'user',blocks:[{type:'tool_result',tool_use_id:'c2',content:'x'},{type:'tool_result',tool_use_id:'c3',content:'y'}]},
   {id:'a4',role:'assistant',blocks:[{type:'tool_use',id:'c4',name:'Edit',input:{file_path:'CHANGELOG.md',old_string:'a',new_string:'b\nc'}}]},
   {id:'r4',role:'user',blocks:[{type:'tool_result',tool_use_id:'c4',content:'The file CHANGELOG.md has been updated successfully.'}]},
   {id:'a5',role:'assistant',blocks:[{type:'text',text:'Now the live-diagnostics service, following the same shape as `SpritePreview`.'}]},
   {id:'a6',role:'assistant',blocks:[{type:'tool_use',id:'c6',name:'File changes',input:{status:'completed',changes:[{path:'src/layout.ts',kind:'update',diff:'@@\n-old\n+adaptive'}]}}]},
   {id:'a7',role:'assistant',blocks:[{type:'text',text:'Updated the layout.'}]}];
 });
 await desktop(page);await page.getByRole('button',{name:/claude · Interface review/}).click();await page.waitForTimeout(1200);
 await page.locator('.desktop-chat-host').screenshot({path:'.local/activity-look.png'});
 const info=await page.evaluate(()=>{const left=(e:Element|null)=>{if(!e)return null;const r=document.createRange();const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);const t=walker.nextNode();if(!t)return null;r.setStart(t,0);r.setEnd(t,1);return Math.round(r.getBoundingClientRect().left*10)/10;};
  const out:any[]=[];for(const e of document.querySelectorAll('.conversation-inner > article.message.assistant')){const target=e.querySelector('summary')||e.querySelector('.markdown p');out.push({cls:e.className.slice(0,40),left:left(target),size:target?getComputedStyle(target).fontSize:'',chain:[...(function*(){let x:any=target?.querySelector('span')||null;while(x&&x!==e){const c=getComputedStyle(x);yield (x.className||x.tagName).toString().slice(0,20)+':'+c.paddingLeft+'/'+c.marginLeft+'/'+c.textIndent;x=x.parentElement;}})()].join(' | ')});}
  return out;});
 expect(new Set(info.map((row:any)=>row.left)).size).toBe(1);
 expect(new Set(info.map((row:any)=>row.size)).size).toBe(1);
 // no reserved row of answer buttons between lines: neighbouring lines are at most 24 px apart
 const gaps=await page.locator('.conversation-inner > article.message.assistant').evaluateAll(list=>list.slice(1).map((e,i)=>Math.round(e.getBoundingClientRect().top-list[i].getBoundingClientRect().bottom)));
 for(const gap of gaps.slice(0,-1))expect(gap).toBe(4);
 // Appearance → Space between blocks changes every gap at once
 await page.evaluate(()=>document.documentElement.style.setProperty('--chat-block-gap','10px'));
 const roomy=await page.locator('.conversation-inner > article.message.assistant').evaluateAll(list=>list.slice(1).map((e,i)=>Math.round(e.getBoundingClientRect().top-list[i].getBoundingClientRect().bottom)));
 for(const gap of roomy.slice(0,-1))expect(gap).toBe(10);
});
