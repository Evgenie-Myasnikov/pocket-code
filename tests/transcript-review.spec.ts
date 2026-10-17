import {test,expect} from '@playwright/test';
import {openChatList} from './chat-navigation';

const messages=[
 {id:'ask',role:'user',blocks:[{type:'text',text:'Fix the sample validation'}]},
 {id:'read',role:'assistant',blocks:[{type:'tool_use',id:'r1',name:'Read',input:{file_path:'C:/Sample/src/form.ts'}},{type:'tool_use',id:'g1',name:'Grep',input:{pattern:'validate',path:'src'}}]},
 {id:'plan',role:'assistant',blocks:[{type:'tool_use',id:'p1',name:'TodoWrite',input:{todos:[{content:'Find the check',status:'completed'},{content:'Fix the check',status:'in_progress',activeForm:'Fixing the check'},{content:'Run tests',status:'pending'}]}}]},
 {id:'lint',role:'assistant',blocks:[{type:'tool_use',id:'c1',name:'Bash',input:{command:'npm run lint'}},{type:'tool_result',tool_use_id:'c1',is_error:true,content:'> sample lint\nsrc/form.ts:4:1 error Unexpected value\n1 problem'}]},
 {id:'edit',role:'assistant',blocks:[{type:'tool_use',id:'e1',name:'Edit',input:{file_path:'C:/Sample/src/form.ts',old_string:'a\nb',new_string:'a\nc\nd'}}]},
 {id:'answer',role:'assistant',blocks:[{type:'text',text:'Fixed.\n\n```ts\nconst ok = true;\n```'}]},
 {id:'notice',role:'user',blocks:[{type:'text',text:'<task-notification><task-id>sample1</task-id><status>completed</status><summary>Background check finished</summary></task-notification>'}]},
];
async function open(page:import('@playwright/test').Page,mode?:'brief'|'detailed'){
 await page.addInitScript(mode=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));if(mode)localStorage.setItem('pocket-code-detail-mode-v1',mode);},mode);
 await page.route('**/api/sessions?*',r=>r.fulfill({json:[{sessionId:'review-test',summary:'Transcript review',cwd:'C:/Sample',lastModified:1}]}));
 await page.route('**/api/sessions/review-test/messages?*',r=>r.fulfill({json:{messages,previous:null,next:null}}));
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');await openChatList(page);await page.getByRole('button',{name:/Transcript review/}).click();
}
test('brief transcript folds routine work, keeps errors, plan, changes and notices readable',async({page})=>{
 await open(page);
 const group=page.locator('.activity-group');await expect(group).toHaveCount(1);
 await expect(group.locator(':scope > summary')).toHaveText('Explored 1 file · 1 search');
 const failed=page.locator('.tool-card.failed');await expect(failed.locator('summary .tool-title')).toHaveText('npm run lint');
 await expect(failed.locator('.tool-error-lines')).toContainText('src/form.ts:4:1 error Unexpected value');
 await failed.locator('summary').click();await expect(failed.locator('.tool-output')).toContainText('> sample lint');
 await expect(failed.getByRole('button',{name:'Copy output'})).toBeVisible();await expect(failed.getByRole('button',{name:'Copy command'})).toBeVisible();
 await expect(page.locator('.turn-changes')).toHaveText('Changed 1 file · +2 −1');
 await expect(page.locator('.code-block-bar')).toContainText('ts');
 const notice=page.locator('.transcript-event-message');await expect(notice).toContainText('Background tasks completed');await expect(page.locator('.message.user .claude-task-notification')).toHaveCount(0);
 await expect(page.locator('.plan-bar')).toContainText('Plan 1/3');await expect(page.locator('.plan-bar')).toContainText('Fixing the check');
 await page.locator('.plan-bar-toggle').click();await expect(page.locator('.plan-bar .plan-checklist li')).toHaveCount(3);
 await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitemradio',{name:'Detailed'}).click();
 await expect(page.locator('.activity-group')).toHaveCount(1);await expect(page.locator('.tool-card .tool-title',{hasText:'Edited form.ts'})).toBeVisible();
 await page.screenshot({path:'.local/transcript-review.png'});
});
test('the round latest button replaces the two pills and the beginning lives in the menu',async({page})=>{
 await open(page,'detailed');
 await expect(page.locator('.chat-scroll-actions')).toHaveCount(0);
 await page.locator('.conversation').evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
 const latest=page.getByRole('button',{name:/^Jump to latest messages/});
 if(await page.locator('.conversation').evaluate(el=>el.scrollHeight-el.clientHeight>80)){await expect(latest).toBeVisible();await latest.click();await expect(latest).toHaveCount(0);}
 await page.getByRole('button',{name:'More actions',exact:true}).click();await expect(page.getByRole('menuitem',{name:'Go to beginning'})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);await expect(page.getByRole('button',{name:'Back to chats',exact:true})).toBeVisible();
});
