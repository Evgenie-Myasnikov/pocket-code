import {test,expect} from '@playwright/test';
test('completion drains letter queue and latest action replaces dotted footer',async({page})=>{
 await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-nav:visible,.desktop-tabs:visible').first().waitFor();
 await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
  const {LivePresentationHarness}=await import('/tests/fixtures/LivePresentationHarness.tsx' as string);
  const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(React.createElement(LivePresentationHarness));
 });
 const answer=page.locator('#answer');await expect.poll(async()=>(await answer.innerText()).length).toBeGreaterThan(0);
 await page.evaluate(()=>(window as any).finish());expect((await answer.innerText()).length).toBeLessThan(55);
 await expect(answer).toHaveText('A synthetic streamed response that must finish smoothly.');
 await expect(page.getByRole('status')).toHaveText('npm run build');await expect(page.locator('.pulse-dot')).toHaveCount(0);
 expect(await page.locator('.action-shimmer').evaluate(e=>getComputedStyle(e).animationName)).toBe('action-sweep');
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.action-shimmer').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
});
