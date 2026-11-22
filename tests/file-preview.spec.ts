import {test,expect} from '@playwright/test';
import {join} from 'node:path';

const source = [
  'export function formatPrice(value: number) {',
  "  return new Intl.NumberFormat('en', {",
  "    style: 'currency',",
  "    currency: 'USD',",
  '  }).format(value);',
  '}',
].join('\n');

for (const width of [320, 1150]) {
  test(`file preview keeps its actions in one row at ${width}px before opening search`, async ({page}) => {
    await page.setViewportSize({width,height: width === 320 ? 640 : 800});
    await page.route('**/api/file?**', route => route.fulfill({json:{text:source}}));
    await page.goto(test.info().project.use.baseURL || 'http://127.0.0.1:5173');
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js' as string)).default;
      const {createRoot} = (await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
      const {FilePreview} = await import('/src/Files.tsx' as string);
      const mount = document.body.appendChild(document.createElement('div'));
      createRoot(mount).render(React.createElement(FilePreview, {
        connection:{url:location.origin,token:'synthetic-fixture'},root:'/sample',path:'/sample/price.ts',onClose:()=>{},
      }));
    });
    const dialog = page.getByRole('dialog',{name:'price.ts'});
    await expect(dialog.locator('pre')).toHaveText(source,{useInnerText:false});
    await expect(dialog.getByRole('searchbox')).toHaveCount(0);
    const actions=dialog.locator('header button');
    await expect(actions).toHaveCount(3);
    expect(await actions.evaluateAll(nodes=>new Set(nodes.map(el=>el.getBoundingClientRect().top)).size)).toBe(1);
    await expect(dialog.locator('pre')).toHaveCSS('white-space','pre-wrap');
    if(process.env.POCKET_THEME_PREVIEWS)await dialog.screenshot({path:join(process.env.POCKET_THEME_PREVIEWS,`reader-${width}.png`)});
    await actions.first().click();
    await expect(dialog.locator('pre')).toHaveCSS('white-space','pre');
    await actions.nth(1).click();
    await dialog.getByRole('searchbox').fill('currency');
    await expect(dialog.locator('mark')).toHaveCount(2);
    await page.keyboard.press('Enter');
    await expect(dialog.locator('mark.current')).toHaveAttribute('data-match','1');
  });
}
