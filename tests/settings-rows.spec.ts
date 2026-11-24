import {test,expect,type Page} from '@playwright/test';
import {desktop} from './desktop-fixture';

// PC settings follow one layout: a heading per group, one card, rows with the name on the left and the control on the right.
const sections=['Connection and startup','Updates','Providers','Chat','Board','Appearance & language','Notifications'];
const shot=(name:string)=>'artifacts/screenshots/settings-rows-'+name+'.png';
async function open(page:Page,name:string){await page.locator('.settings-index').getByRole('button',{name,exact:true}).click();await expect(page.locator('.settings-detail>h2')).toHaveText(name);}

test('every PC settings section is cards of rows with right-aligned controls and no step labels or long hints',async({page})=>{
 await page.setViewportSize({width:1400,height:1000});
 await page.addInitScript(()=>localStorage.setItem('pocket-code-language-v1','en'));
 await desktop(page);await page.getByRole('button',{name:'Settings',exact:true}).click();
 for(const name of sections){
  await open(page,name);
  const detail=page.locator('.settings-detail');
  await expect(detail.locator('.settings-card').first()).toBeVisible();
  await expect(detail).not.toContainText(/Step \d/);
  // Visible explanations stay one short line; longer ones live behind a help button.
  const long=await detail.evaluate(root=>[...root.querySelectorAll<HTMLElement>('.settings-row-text>small, .settings-line>p, .settings-scope')].filter(el=>el.offsetParent&&el.innerText.length>120).map(el=>el.innerText));
  expect(long,name).toEqual([]);
  // Every control column ends at the card's inner right edge.
  const misaligned=await detail.evaluate(root=>[...root.querySelectorAll<HTMLElement>('.settings-row:not(.wide)>.settings-row-control')].filter(el=>el.offsetParent).filter(control=>{const card=control.closest('.settings-card')!,inner=card.getBoundingClientRect().right-parseFloat(getComputedStyle(card).paddingRight)-1;return Math.abs(control.getBoundingClientRect().right-inner)>2;}).length);
  expect(misaligned,name).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name).toBeTruthy();
  // A tall window shows the whole section in one synthetic screenshot.
  await page.setViewportSize({width:1400,height:2400});await page.locator('.settings-detail').screenshot({path:shot(name.replace(/\W+/g,'-').toLowerCase())});await page.setViewportSize({width:1400,height:1000});
 }
});

test('connection rows keep their behaviour: switches call the PC shell and the devices card stays',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('pocket-code-language-v1','en'));
 await desktop(page,{phoneAccess:true,activePhoneAccess:true});await page.getByRole('button',{name:'Settings',exact:true}).click();await open(page,'Connection and startup');
 await expect(page.getByRole('heading',{name:'Phone access',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Connect your phone',exact:true})).toBeVisible();
 await page.getByRole('switch',{name:'Start with Windows'}).click();
 await page.getByRole('switch',{name:'Allow phone access'}).click();
 const calls=await page.evaluate(()=>(window as any).desktopCalls);
 expect(calls.some((call:any)=>call.action==='settings'&&call.startup===true)).toBeTruthy();
 expect(calls.some((call:any)=>call.action==='settings'&&call.phoneAccess===false)).toBeTruthy();
 await expect(page.locator('.desktop-devices')).toBeVisible();
 // The long device explanation opens from the help button only.
 const help=page.getByRole('button',{name:'About connected devices'});await expect(page.getByText(/Devices go offline after 45 seconds/)).toBeHidden();await help.click();await expect(page.getByText(/Devices go offline after 45 seconds/)).toBeVisible();
});

test('provider card rows: access and spend limit are selects that save device defaults, sign-in keeps confirmation',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('pocket-code-language-v1','en'));
 await desktop(page);await page.getByRole('button',{name:'Settings',exact:true}).click();await open(page,'Providers');
 const claude=page.getByRole('region',{name:'Claude',exact:true});
 await expect(claude.getByText('Signed in',{exact:true})).toBeVisible();
 await claude.getByLabel('Agent access').selectOption('acceptEdits');
 expect(await page.evaluate(()=>localStorage.getItem('pocket-code-claude-access'))).toBe('acceptEdits');
 await expect(claude.getByText('Files change without asking; commands ask first.')).toBeVisible();
 const limit=claude.getByLabel('Spend limit per run');await limit.selectOption('20');await expect(limit).toHaveValue('20');
 await limit.selectOption('custom');const amount=claude.getByLabel('Amount, $');await amount.fill('7.5');await amount.press('Enter');await expect(amount).toHaveValue('7.5');
 await claude.getByRole('button',{name:'Sign out',exact:true}).click();await expect(claude.getByText(/Signs out the CLI on this PC/)).toBeVisible();await claude.getByRole('button',{name:'Cancel',exact:true}).click();
 const codex=page.getByRole('region',{name:'Codex',exact:true});await codex.getByLabel('Agent access').selectOption('full');
 await codex.getByRole('button',{name:'Device code',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).desktopCalls.find((v:any)=>v.action==='provider-login'))).toMatchObject({provider:'codex',method:'device'});
 expect(await page.evaluate(()=>(window as any).desktopCalls.some((v:any)=>v.action==='provider-logout'))).toBeFalsy();
});
