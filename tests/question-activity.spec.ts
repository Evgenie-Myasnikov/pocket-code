import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

test('an answered question shows the question, its choices and the answer instead of raw fields',async({page})=>{
 await page.addInitScript(()=>{
   const questions=[{header:'Which error',multiSelect:false,question:'Which error do you mean?',options:[{label:'Verify probes red',description:'The red Verify run.'},{label:'IDE/build error text',description:'An error in the IDE.'}]}];
   (window as any).testRuns=[{id:'run-alpha',provider:'claude',sessionId:'alpha',cwd:'C:\Demo\Atlas',status:'done',
     messages:[{id:'u',role:'user',blocks:[{type:'text',text:'It does not compile.'}]},
       {id:'a',role:'assistant',blocks:[{type:'tool_use',id:'q1',name:'AskUserQuestion',input:{questions}}]},
       {id:'r',role:'user',blocks:[{type:'tool_result',tool_use_id:'q1',content:'User has answered your questions: "Which error do you mean?"="IDE/build error text". You can now continue with the user\'s answers in mind.'}]},
       {id:'b',role:'assistant',blocks:[{type:'text',text:'Paste the error text, please.'}]}],
     approvals:[],revision:1,startedAt:Date.now()-5000,finishedAt:Date.now(),baseMessageCount:0}];
 });
 await desktop(page);
 await page.locator('.desktop-sessions > button[data-chat-id="alpha"]').click();
 const card=page.locator('.conversation-inner .tool-card').filter({hasText:'Question'});
 await card.locator('summary').first().click();
 const body=card.locator('.question-activity');
 await expect(body.locator('.question-activity-text')).toHaveText('Which error do you mean?');
 await expect(body.locator('li[data-chosen]')).toContainText('IDE/build error text');
 await expect(body.locator('.question-activity-answer')).toContainText('IDE/build error text');
 await expect(card).not.toContainText('multiSelect');await expect(card).not.toContainText('continue with the user');
 await page.screenshot({path:'.local/question-activity.png'});
});
