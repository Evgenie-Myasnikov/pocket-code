import {test,expect,type Page} from '@playwright/test';

// Resolves every role through the browser (OKLCH, color-mix) and checks WCAG contrast for all 20 theme × palette combinations.
async function contrastReport(page:Page){
 return page.evaluate(async()=>{
  const {palettes}=await import('/src/Appearance.tsx' as string) as {palettes:{id:string;hue:number;hslHue:number}[]};
  const root=document.documentElement,canvas=document.createElement('canvas').getContext('2d',{willReadFrequently:true})!,probe=document.createElement('span');document.body.append(probe);
  const rgb=(variable:string)=>{probe.style.color=`var(${variable})`;canvas.clearRect(0,0,1,1);canvas.fillStyle='#000';canvas.fillStyle=getComputedStyle(probe).color;canvas.fillRect(0,0,1,1);return [...canvas.getImageData(0,0,1,1).data].slice(0,3).map(v=>v/255);};
  const lum=(c:number[])=>{const [r,g,b]=c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
  const ratio=(a:string,b:string)=>{const x=lum(rgb(a)),y=lum(rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  const failures:string[]=[];const check=(label:string,value:number,min:number)=>{if(value<min)failures.push(`${label} ${value.toFixed(2)} < ${min}`);};
  for(const contrast of ['normal','more'])for(const theme of ['dark','light'])for(const palette of palettes){
   root.dataset.theme=theme;root.dataset.palette=palette.id;root.dataset.contrast=contrast;root.dataset.colorblind='false';root.style.setProperty('--palette-hue',String(palette.hue));root.style.setProperty('--palette-hsl-hue',String(palette.hslHue));
   const name=`${contrast}/${theme}/${palette.id}`;
   check(name+' text/bg',ratio('--text','--bg'),7);check(name+' muted/bg',ratio('--muted','--bg'),4.5);check(name+' muted/panel',ratio('--muted','--panel'),4.5);check(name+' accent/bg',ratio('--accent','--bg'),4.5);check(name+' on-accent/accent',ratio('--on-accent','--accent'),4.5);check(name+' input/bg',ratio('--input','--bg'),3);
   for(const family of ['success','warning','danger','info','review','running']){check(`${name} ${family}-fg/bg`,ratio(`--${family}-fg`,'--bg'),4.5);check(`${name} ${family}-fg/panel`,ratio(`--${family}-fg`,'--panel'),4.5);check(`${name} ${family}-fg/${family}-bg`,ratio(`--${family}-fg`,`--${family}-bg`),4.5);check(`${name} ${family}-border/bg`,ratio(`--${family}-border`,'--bg'),3);}
  }
  for(const theme of ['dark','light']){root.dataset.theme=theme;root.dataset.palette='sage';root.dataset.contrast='normal';root.dataset.colorblind='true';for(const family of ['success','danger'])check(`colorblind/${theme} ${family}-fg/bg`,ratio(`--${family}-fg`,'--bg'),4.5);}
  probe.remove();return failures;
 });
}

test('every theme and palette keeps text, muted, accent, field borders and status families readable',async({page})=>{
 await page.goto('http://127.0.0.1:5173');
 await page.locator('.mobile-tabbar:visible,.desktop-tabs:visible,.connect-page').first().waitFor();
 expect(await contrastReport(page)).toEqual([]);
});

test('PC chat-row status dots and labels look the same for every status in both themes',async({page})=>{
 await page.goto('http://127.0.0.1:5173');
 await page.locator('.mobile-tabbar:visible,.desktop-tabs:visible,.connect-page').first().waitFor();
 for(const theme of ['dark','light']){
  const rows=await page.evaluate(async(theme)=>{
   const React=(await import('/node_modules/.vite/deps/react.js' as string)).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
   const {ChatRunStatus,RunStatusDot}=await import('/src/run-status.tsx' as string);
   document.documentElement.dataset.theme=theme;document.documentElement.dataset.palette='sage';document.documentElement.style.setProperty('--palette-hue','132');
   const host=document.createElement('div');host.style.cssText='background:var(--bg);padding:12px;width:320px';document.body.replaceChildren(host);
   const statuses=['needs_input','running','done','error'];
   createRoot(host).render(React.createElement('div',null,statuses.map(status=>React.createElement('button',{key:status,className:'desktop-session',style:{display:'flex',alignItems:'center',gap:8}},React.createElement(RunStatusDot,{status,className:'desktop-chat-dot',labelled:false}),React.createElement('small',{className:'desktop-run-label'},React.createElement(ChatRunStatus,{status}))))));
   await new Promise(resolve=>setTimeout(resolve,50));
   const canvas=document.createElement('canvas').getContext('2d')!;const rgb=(value:string)=>{canvas.clearRect(0,0,1,1);canvas.fillStyle=value;canvas.fillRect(0,0,1,1);return [...canvas.getImageData(0,0,1,1).data].slice(0,3).map(v=>v/255);};
   const lum=(c:number[])=>{const [r,g,b]=c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
   const bg=lum(rgb(getComputedStyle(host).backgroundColor));
   return [...host.querySelectorAll('.desktop-run-label')].map(label=>{const dot=label.previousElementSibling as HTMLElement,status=label.querySelector('.run-status') as HTMLElement,style=getComputedStyle(label),fg=lum(rgb(getComputedStyle(status).color));
    return {height:Math.round(label.getBoundingClientRect().height),dot:Math.round(dot.getBoundingClientRect().width),background:style.backgroundColor,border:style.borderTopWidth,contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};});
  },theme);
  expect(rows).toHaveLength(4);
  for(const row of rows){expect(row.height).toBe(rows[0].height);expect(row.height).toBeLessThanOrEqual(24);expect(row.dot).toBe(8);expect(row.background).toBe('rgba(0, 0, 0, 0)');expect(row.border).toBe('0px');expect(row.contrast).toBeGreaterThanOrEqual(4.5);}
 }
});

test('Windows chrome text is at least 12 px at 100 % and phone text at least 11 px',async({page})=>{
 const smallest=(min:number)=>page.evaluate(min=>[...document.querySelectorAll<HTMLElement>('body *')].filter(el=>[...el.childNodes].some(node=>node.nodeType===3&&node.textContent!.trim())&&el.getBoundingClientRect().width>0&&getComputedStyle(el).visibility!=='hidden'&&parseFloat(getComputedStyle(el).fontSize)<min-.01).map(el=>`${el.className||el.tagName} ${getComputedStyle(el).fontSize}`),min);
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:5173/?desktop=1');await page.locator('.desktop-connection-status').waitFor();
 expect(await smallest(12)).toEqual([]);
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173');await page.locator('.mobile-tabbar:visible').first().waitFor();
 expect(await smallest(11)).toEqual([]);
});
