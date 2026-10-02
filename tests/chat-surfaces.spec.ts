import {test,expect,type Page} from '@playwright/test';

const project='C:\\Workspace\\chat-surfaces';
const agent={id:'child',name:'Check the responsive layout and navigation',status:'running',provider:'codex',parentSessionId:'chat',source:'history'};
async function openChat(page:Page,language:string,textSize:number){
  await page.addInitScript(({language,textSize})=>{
    sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));
    localStorage.setItem('pocket-code-workspace','codex');localStorage.setItem('pocket-code-language-v1',language);
    localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({textSize,scale:130,palette:'sage'}));
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{(window as any).__copied=text;}}});
  },{language,textSize});
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname.replace('/api','');
    if(path==='/health')return route.fulfill({json:{name:'Example PC',roots:[project],protocol:1,version:'0.14.1'}});
    if(path==='/providers')return route.fulfill({json:[{id:'codex',name:'Codex',available:true,authenticated:true,models:[]}]});
    if(path==='/projects')return route.fulfill({json:[project]});
    if(path==='/sessions')return route.fulfill({json:[{sessionId:'chat',provider:'codex',summary:'Surface example',cwd:project,lastModified:Date.now()}]});
    if(path==='/sessions/chat/messages')return route.fulfill({json:{messages:[
      {id:'user-short',role:'user',blocks:[{type:'text',text:'Thanks!'}]},
      {id:'user-rich',role:'user',blocks:[{type:'text',text:'Please check this file.\n\n```ts\nconst name = "a-long-example-that-must-not-expand-the-chat";\n```'},{type:'document',title:'Notes.md',source:{text:'Keep the navigation simple.'}}]},
      {id:'agents-only',role:'assistant',blocks:[{type:'subagent',agent}]},
    ],previous:null,next:null}});
    if(path==='/sessions/chat/subagents')return route.fulfill({json:{agents:[agent]}});
    if(path==='/sessions/chat/subagents/child/messages')return route.fulfill({json:{messages:[{id:'child-content',role:'assistant',blocks:[{type:'text',text:'The compact controls are reachable.'}]}]}});
    if(path==='/jobs')return route.fulfill({json:[]});
    if(path==='/updates/latest')return route.fulfill({json:{enabled:false}});
    return route.fulfill({status:404,json:{error:'Synthetic endpoint not configured'}});
  });
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button',{name:/Surface example/}).click();
  await expect(page.locator('[data-message-id="agents-only"]')).toBeVisible();
}

for(const profile of [{width:320,language:'en',textSize:8},{width:360,language:'ru',textSize:22},{width:412,language:'en',textSize:14}]){
  test(`quiet user and subagent surfaces fit ${profile.width}px ${profile.language} ${profile.textSize}px`,async({page})=>{
    await page.setViewportSize({width:profile.width,height:820});await openChat(page,profile.language,profile.textSize);
    await expect(page.locator('.chat-header select')).toHaveCount(0);
    const user=page.locator('[data-message-id="user-short"]'),agents=page.locator('[data-message-id="agents-only"]');
    await expect(user.locator('.message-label')).toHaveCount(0);await expect(agents.locator('.message-label')).toHaveCount(0);
    await user.locator('.copy-button').click();await expect.poll(()=>page.evaluate(()=>(window as any).__copied)).toBe('Thanks!');
    const metrics=await page.locator('.conversation-inner').evaluate(element=>({
      width:element.clientWidth,scrollWidth:element.scrollWidth,
      bubble:element.querySelector('.user-message-content')!.getBoundingClientRect().width,
      message:element.querySelector('.message.user')!.getBoundingClientRect().width,
      rows:[...element.querySelectorAll('.message.user,.subagent-card')].map(row=>({border:getComputedStyle(row).borderTopWidth,bg:getComputedStyle(row).backgroundColor})),
      targets:[...element.querySelectorAll('.copy-button,.subagent-card')].map(button=>button.getBoundingClientRect().height),
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width+1);
    expect(metrics.bubble).toBeLessThan(profile.width*.7);
    expect(metrics.rows.every(row=>row.border==='0px'&&row.bg==='rgba(0, 0, 0, 0)')).toBeTruthy();
    expect(metrics.targets.every(height=>height>=48)).toBeTruthy();
    await expect(page.locator('[data-message-id="user-rich"]')).toContainText('Keep the navigation simple.');
    await agents.locator('.subagent-card').click();await expect(page.locator('.subagents-panel')).toContainText('The compact controls are reachable.');
    await page.getByRole('button',{name:profile.language==='ru'?'Вернуться в чат':'Back to chat',exact:true}).click();
    await expect(agents.locator('.subagent-card')).toBeFocused();
    await page.screenshot({path:`artifacts/screenshots/chat-surface-${profile.width}.png`,fullPage:true});
  });
}
