import {test,expect} from '@playwright/test';
test('phone background defaults off and explicit settings persist',async({page})=>{
 await page.goto('http://127.0.0.1:5173');
 const mount=()=>page.evaluate(async()=>{const React=(await import('/node_modules/.vite/deps/react.js' as string)).default;const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;const {BackgroundSettings}=await import('/src/background-settings.tsx' as string);const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(BackgroundSettings));});
 await mount();await expect(page.getByLabel('Show background')).not.toBeChecked();await expect(page.locator('.chat-atmosphere')).toHaveCount(0);
 await page.getByLabel('Show background').check();await expect(page.locator('.chat-atmosphere')).toBeVisible();
 await page.getByLabel('Motion speed').fill('0');await page.getByLabel('Intensity').fill('65');
 await page.reload();await mount();await expect(page.getByLabel('Show background')).toBeChecked();await expect(page.getByLabel('Motion speed')).toHaveValue('0');await expect(page.getByLabel('Intensity')).toHaveValue('65');
 await page.getByLabel('Show background').uncheck();await expect(page.locator('.chat-atmosphere')).toHaveCount(0);
});
