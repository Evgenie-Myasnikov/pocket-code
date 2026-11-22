import {expect,test} from '@playwright/test';
import {desktop} from './desktop-fixture';

for (const enterSends of [true,false]) {
  test(`IME confirmation preserves the draft with Enter sending ${enterSends ? 'on' : 'off'}`,async({page})=>{
    await page.addInitScript(enterSends=>{
      localStorage.setItem('pocket-code-composer',JSON.stringify({enterSends}));
    },enterSends);
    await desktop(page);
    await page.getByRole('button',{name:'New chat',exact:true}).click();
    const draft=page.getByRole('textbox',{name:'Message Claude',exact:true});
    await draft.fill('入力中');
    const ignored=await draft.evaluate((element,ctrlKey)=>{
      const confirmation=(isComposing:boolean,keyCode:number)=>element.dispatchEvent(new KeyboardEvent('keydown',{
        key:'Enter',code:'Enter',isComposing,keyCode,ctrlKey,bubbles:true,cancelable:true,
      }));
      return [confirmation(true,13),confirmation(false,229)];
    },!enterSends);
    expect(ignored).toEqual([true,true]);
    await expect(draft).toHaveValue('入力中');
    await expect(draft).toHaveAttribute('enterkeyhint',enterSends?'send':'enter');
    await expect(draft).toHaveAccessibleDescription(enterSends?'Enter to send · Shift+Enter for a new line':'Enter for a new line · Ctrl+Enter to send');
    await draft.press(enterSends?'Shift+Enter':'Enter');
    await expect(draft).toHaveValue('入力中\n');
    await draft.press(enterSends?'Enter':'Control+Enter');
    await expect(draft).toHaveValue('');
    const jobs=await page.evaluate(()=>(window as any).desktopCalls.filter((c:{action:string;endpoint:string})=>c.action==='write'&&c.endpoint==='/jobs'));
    expect(jobs).toHaveLength(1);
  });
}

test('Escape during composition stays with the input method while a chat is running',async({page})=>{
  await desktop(page);
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  const draft=page.getByRole('textbox',{name:'Message Claude',exact:true});
  await draft.fill('Synthetic running turn');
  await draft.press('Enter');
  await expect(page.locator('.composer .stop-button')).toBeVisible();
  await draft.fill('変換');
  const handledByBrowser=await draft.evaluate(element=>element.dispatchEvent(new KeyboardEvent('keydown',{
    key:'Escape',code:'Escape',isComposing:true,bubbles:true,cancelable:true,
  })));
  expect(handledByBrowser).toBe(true);
  await expect(draft).toHaveValue('変換');
  const stopCalls=()=>page.evaluate(()=>(window as any).desktopCalls.filter((c:{endpoint?:string})=>c.endpoint?.endsWith('/stop')).length);
  expect(await stopCalls()).toBe(0);
  await draft.press('Escape');
  await expect.poll(stopCalls).toBe(1);
});
