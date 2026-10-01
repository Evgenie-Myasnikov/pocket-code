import {test,expect} from '@playwright/test';
test('capture public documentation with synthetic data only',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{sessionStorage.setItem('connection',JSON.stringify({url:'http://127.0.0.1:4319',token:'test-only-'.repeat(5)}));localStorage.setItem('pocket-code-workspace','codex');localStorage.setItem('pocket-code-appearance-v1',JSON.stringify({scale:100,textSize:14,palette:'sage',theme:'dark'}));});
 const root='C:\\Projects\\garden-app';
 await page.route('**/api/**',route=>{
  const p=new URL(route.request().url()).pathname.replace('/api','');let json:unknown;
  if(p==='/health')json={name:'Example PC',roots:[root],protocol:1,version:'0.18.1'};
  else if(p==='/providers')json=[{id:'codex',name:'Codex',available:true,authenticated:true,models:[{id:'gpt-5.4',name:'GPT-5.4',isDefault:true}]}];
  else if(p==='/projects')json=[root];
  else if(p==='/sessions')json=[{sessionId:'example',provider:'codex',summary:'Make the home page easier to use',cwd:root,lastModified:Date.now()}];
  else if(p==='/sessions/example/messages')json={messages:[{id:'question',role:'user',blocks:[{type:'text',text:'Make the garden app easier to use on a phone.'}]},{id:'answer',role:'assistant',blocks:[{type:'text',text:'## A simpler home page\n\nThe next watering task is now the main action. Plant cards stack in one column on small screens.\n\n- Larger touch targets\n- Clear watering reminders\n- Less visual clutter\n\n```css\n.plants {\n  display: grid;\n  gap: 16px;\n}\n```\n\nThe layout checks pass. You can review the changes before continuing.'}]}],previous:null,next:null};
  else if(p==='/jobs')json=[];
  else if(p==='/updates/latest')json={enabled:false};
  else if(p==='/project-docs')json={project:root,documents:[],truncated:false};
  else if(p==='/task-notifications')json={items:[],unread:0};
  else return route.fulfill({status:404,json:{error:'Demo endpoint unavailable'}});
  return route.fulfill({json});
 });
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:/Make the home page/}).click();await expect(page.getByText('A simpler home page',{exact:true})).toBeVisible();
 await page.screenshot({path:'docs/images/chat.png'});
 await page.locator('.mobile-nav').getByRole('button',{name:'Project',exact:true}).click();await expect(page.locator('.project-overview-cards')).toBeVisible();await page.screenshot({path:'docs/images/project.png'});
 await page.locator('.mobile-nav').getByRole('button',{name:'Settings',exact:true}).click();await expect(page.locator('.settings-category').first()).toBeVisible();await page.screenshot({path:'docs/images/settings.png'});
});
