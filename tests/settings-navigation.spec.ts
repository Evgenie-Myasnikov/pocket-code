import {test,expect,type Page} from '@playwright/test';
import {newChat,openChatList,openSection} from './chat-navigation';
import {openConnectionSettings} from './qr-connect';
async function setup(page:Page){
  await page.route('**/api/**',route=>{const url=new URL(route.request().url()),path=url.pathname;let body:unknown={};
    if(path.endsWith('/health'))body={name:'Settings test computer',roots:['C:\\Workspace\\example'],version:'0.12.0',protocol:1};
    else if(path.endsWith('/projects'))body=['C:\\Workspace\\example'];
    else if(path.endsWith('/providers'))body=[{id:'claude',available:true},{id:'codex',available:true,authenticated:true,models:[]}];
    else if(path.endsWith('/sessions')||path.endsWith('/jobs'))body=[];
    else if(path.endsWith('/review/availability'))body={available:false,mode:'working'};
    else if(path.endsWith('/updates/latest'))body={enabled:false};
    else if(path.endsWith('/usage'))body={buckets:[],checkedAt:Date.now()};
    else if(path.endsWith('/jira/status'))body={connected:false,sites:[]};
    return route.fulfill({json:body});
  });
  await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-workspace','codex');localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({palette:'sage',theme:'light',textSize:14,scale:130}));});
  await page.goto('http://127.0.0.1:5173');await openChatList(page);await expect(page.getByRole('button',{name:'New chat',exact:true})).toBeVisible();
}
test('home stays focused; categorized Settings restores focus and Back preserves the draft',async({page})=>{
  await page.setViewportSize({width:390,height:844});await setup(page);
  await expect(page.locator('.sidebar .brand,.sidebar .host-card,.sidebar-footer')).toHaveCount(0);await newChat(page);await page.getByLabel('Message Codex').fill('Keep my draft');
  await openSection(page,'Settings');await expect(page.locator('.settings-index .settings-category')).toHaveCount(8);await expect(page.locator('.appearance-settings,.codex-access-settings,.usage-limits,.settings-computer')).toHaveCount(0);
  await page.locator('[data-settings-category="workspace"]').click();await expect(page.getByRole('button',{name:'All settings',exact:true})).toBeFocused();await page.getByRole('button',{name:'Agent access',exact:true}).click();await expect(page.getByRole('radio',{name:'Full access',exact:true})).toBeChecked();
  await page.keyboard.press('Escape');await expect(page.locator('[data-settings-subpage="access"]')).toBeFocused();await expect(page.getByRole('button',{name:'All settings',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('[data-settings-category="workspace"]')).toBeFocused();await page.keyboard.press('Escape');await newChat(page);await expect(page.getByLabel('Message Codex')).toHaveValue('Keep my draft');
  await openSection(page,'Settings');await page.getByRole('button',{name:'About',exact:true}).click();await expect(page.locator('.settings-about')).toContainText('Pocket Code');await expect(page.locator('.settings-about')).toContainText('BETA');
});
for(const profile of [{width:320,height:640},{width:844,height:390}])test(`Disconnect is confirmed from the connection card, not the settings index, at ${profile.width}x${profile.height}`,async({page})=>{
  await page.setViewportSize(profile);await setup(page);
  await openSection(page,'Settings');
  await expect(page.locator('.settings-index .settings-category').first()).toHaveAttribute('data-settings-category','connection');
  await expect(page.locator('[data-settings-category="connection"]')).toContainText('Settings test computer · Connected');
  for(const category of ['appearance','workspace','usage','miro','updates','connection','notifications','about']){
    await page.locator(`[data-settings-category="${category}"]`).click();
    await expect(page.locator('.settings-exit,.settings-disconnect')).toHaveCount(0);
    await page.getByRole('button',{name:'All settings',exact:true}).click();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({path:`artifacts/screenshots/settings-categories-${profile.width}.png`,fullPage:true});
  await page.locator('[data-settings-category="connection"]').click();await expect(page.locator('.connect-status')).toContainText('Settings test computer');
  await page.getByRole('button',{name:'Disconnect…',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Disconnect this phone from Settings test computer?'});
  await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(page.locator('.connect-status')).toBeVisible();
  await page.getByRole('button',{name:'Disconnect…',exact:true}).click();await dialog.getByRole('button',{name:'Disconnect and forget',exact:true}).click();
  await openConnectionSettings(page);await expect(page.getByRole('button',{name:'Choose a QR image',exact:true})).toBeVisible();await expect(page.locator('.connect-status')).toHaveCount(0);
});
