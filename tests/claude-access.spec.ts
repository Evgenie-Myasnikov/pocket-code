import {test,expect} from '@playwright/test';
test('Claude access persists and help remains collapsed until requested',async({page})=>{
 async function mount(){await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav:visible,.desktop-tabs:visible').first().waitFor();await page.evaluate(async()=>{
 const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default,{ClaudeAccessSettings}=await import('/src/ClaudeAccessSettings.tsx' as string);const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(ClaudeAccessSettings));
 });}
 await mount();await expect(page.getByRole('radio',{name:'Ask for approval'})).toBeChecked();await page.getByRole('radio',{name:'Full access'}).check();await mount();await expect(page.getByRole('radio',{name:'Full access'})).toBeChecked();await expect(page.locator('.codex-access-help')).toBeHidden();await page.getByRole('button',{name:'About Claude access modes'}).click();await expect(page.locator('.codex-access-help')).toBeVisible();await page.getByRole('radio',{name:'Accept file edits'}).check();expect(await page.evaluate(()=>localStorage.getItem('pocket-code-claude-access'))).toBe('acceptEdits');
});
