import {test,expect} from '@playwright/test';
test('live commands, agent links and user-role tool results have no bubble background',async({page})=>{
 await page.goto('http://127.0.0.1:5173');
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;const {Message}=await import('/src/Messages.tsx' as string),{RichBlock}=await import('/src/RichBlocks.tsx' as string);
  const root=document.createElement('div');root.id='plain-fixture';document.body.append(root);
  createRoot(root).render(React.createElement(React.Fragment,null,
   React.createElement(RichBlock,{block:{type:'tool_use',id:'command',name:'Bash',input:{command:'echo synthetic'}},running:true}),
   React.createElement(Message,{message:{id:'result',role:'user',blocks:[{type:'tool_result',tool_use_id:'standalone',content:'Synthetic result'}]}}),
   React.createElement(Message,{message:{id:'agent',role:'assistant',blocks:[{type:'subagent',agent:{id:'synthetic-agent',name:'Review helper',status:'running'}}]},onSubagent:()=>{}})));
 });
 const fixture=page.locator('#plain-fixture');await expect(fixture.locator('.tool-card')).toHaveCount(2);await expect(fixture.locator('.subagent-card')).toBeVisible();
 for(const theme of ['dark','light']){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  for(const item of await fixture.locator('.tool-card,.subagent-card').all()){await expect(item).toHaveCSS('background-color','rgba(0, 0, 0, 0)');await expect(item).toHaveCSS('border-top-width','0px');}
  await fixture.locator('.subagent-card').hover();await expect(fixture.locator('.subagent-card')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 }
 await expect(fixture.locator('.user-message-content')).toHaveCount(0);
});
