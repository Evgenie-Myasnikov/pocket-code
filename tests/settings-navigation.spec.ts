import {test,expect,type Page} from '@playwright/test';
async function setup(page:Page){
  await page.route('**/api/**',route=>{const url=new URL(route.request().url()),path=url.pathname;let body:unknown={};
    if(path.endsWith('/health'))body={name:'Settings test computer',roots:['C:\\Workspace\\example'],version:'0.12.0',protocol:1};
    else if(path.endsWith('/projects'))body=['C:\\Workspace\\example'];
    else if(path.endsWith('/providers'))body=[{id:'claude',available:true},{id:'codex',available:true,authenticated:true,models:[]}];
    else if(path.endsWith('/sessions')||path.endsWith('/jobs'))body=[];
    else if(path.endsWith('/review/availability'))body={available:false,mode:'working'};
    else if(path.endsWith('/updates/latest'))body={enabled:false};
    else if(path.endsWith('/jira/status'))body={connected:false,sites:[]};
    return route.fulfill({json:body});
  });
  await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-workspace','codex');localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({palette:'sage',theme:'light',textSize:14,scale:130}));});
  await page.goto('http://127.0.0.1:5173');await expect(page.locator('.new-chat')).toBeVisible();
}
test('home stays focused; categorized Settings restores focus and Back preserves the draft',async({page})=>{
  await page.setViewportSize({width:390,height:844});await setup(page);
  await expect(page.locator('.sidebar .brand,.sidebar .host-card,.sidebar-footer')).toHaveCount(0);await page.locator('.new-chat').click();await page.getByLabel('Message Codex').fill('Keep my draft');
  await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('.settings-index .settings-category')).toHaveCount(7);await expect(page.locator('.appearance-settings,.codex-access-settings,.usage-limits,.settings-computer')).toHaveCount(0);
  await page.getByRole('button',{name:'AI & workspace',exact:true}).click();await expect(page.getByRole('button',{name:'All settings',exact:true})).toBeFocused();await expect(page.getByRole('radio',{name:'Full access',exact:true})).toBeChecked();
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'AI & workspace',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByLabel('Message Codex')).toHaveValue('Keep my draft');
  await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'About',exact:true}).click();await expect(page.locator('.settings-about')).toContainText('Pocket Code');await expect(page.locator('.settings-about')).toContainText('BETA');
});
for(const profile of [{width:320,height:640},{width:844,height:390}])test(`Settings footer stays separate from scrolling content at ${profile.width}x${profile.height}`,async({page})=>{
  await page.setViewportSize(profile);await setup(page);await (profile.width<=760?page.locator('.mobile-nav'):page.locator('.desktop-tabs')).getByRole('button',{name:'Settings',exact:true}).click();
  for(const category of ['', 'Appearance & language']){
    if(category)await page.getByRole('button',{name:category,exact:true}).click();
    const metrics=await page.locator('.settings-panel').evaluate(panel=>{const content=panel.querySelector('.settings-content')!.getBoundingClientRect(),footer=panel.querySelector('.settings-exit')!.getBoundingClientRect(),button=panel.querySelector('.settings-disconnect')!.getBoundingClientRect();return{contentBottom:content.bottom,footerTop:footer.top,footerBottom:footer.bottom,buttonHeight:button.height,spill:document.documentElement.scrollWidth-innerWidth};});
    expect(metrics.contentBottom).toBeLessThanOrEqual(metrics.footerTop+1);expect(metrics.footerBottom).toBeLessThanOrEqual(profile.height);expect(metrics.buttonHeight).toBeGreaterThanOrEqual(48);expect(metrics.spill).toBeLessThanOrEqual(1);
    await page.locator('.settings-content').evaluate(element=>{element.scrollTop=element.scrollHeight;});await expect(page.getByRole('button',{name:'Disconnect and forget',exact:true})).toBeVisible();
  }
  await page.screenshot({path:`artifacts/screenshots/settings-categories-${profile.width}.png`,fullPage:true});await page.getByRole('button',{name:'Disconnect and forget',exact:true}).click();await expect(page.getByRole('button',{name:'Connect computer',exact:true})).toBeVisible();
});
