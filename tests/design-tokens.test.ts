import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

// Raw values live in the token and palette files only; component CSS uses roles, so light themes and contrast modes cannot be bypassed.
const tokenFiles=new Set(['tokens.css','neutral-themes.css','contrast-modes.css']);
const css=readdirSync('src').filter(file=>file.endsWith('.css')).map(file=>({file,source:readFileSync('src/'+file,'utf8')}));
const tsx=readdirSync('src').filter(file=>file.endsWith('.tsx')).map(file=>({file,source:readFileSync('src/'+file,'utf8')}));

test('component CSS has no hex colour literals',()=>{
  const found=css.filter(({file})=>!tokenFiles.has(file)).flatMap(({file,source})=>(source.match(/#[0-9a-fA-F]{3,8}\b/g)||[]).map(value=>`${file}: ${value}`));
  assert.deepEqual(found,[]);
});
test('font weights and global layers come from tokens',()=>{
  const weights=css.filter(({file})=>file!=='tokens.css').flatMap(({file,source})=>(source.match(/font-weight:\s*\d+/g)||[]).map(value=>`${file}: ${value}`));
  assert.deepEqual(weights,[]);
  const layers=css.filter(({file})=>file!=='tokens.css').flatMap(({file,source})=>(source.match(/z-index:\s*\d{2,}/g)||[]).map(value=>`${file}: ${value}`));
  assert.deepEqual(layers,[]);
});
test('status words are never bare class names, and the alert is .error-banner',()=>{
  // A bare `.error` rule once turned the PC chat-row status dot and label into an alert box.
  const globalError=css.flatMap(({file,source})=>(source.match(/(?<![\w-])\.error(?![\w-])/g)||[]).map(()=>file));
  assert.deepEqual(globalError,[]);
  const bareAlert=tsx.filter(({source})=>/className="error[" ]/.test(source)).map(({file})=>file);
  assert.deepEqual(bareAlert,[]);
  const bareStatus=tsx.flatMap(({file,source})=>[...source.matchAll(/className=\{'[\w-]+ '\+\(?(?:[\w.]*status|value|hostAway)\b/g)].map(match=>`${file}: ${match[0]}`));
  assert.deepEqual(bareStatus,[]);
  // Elements that moved to data-status must not keep class-based status rules (a pending device lost its colour that way).
  const staleStatus=css.flatMap(({file,source})=>(source.match(/\.(?:desktop-device-status|subagent-status|subagent-card|rule-chip|connect-chip|desktop-chat-dot|review-file-status)\.(?!run-status-dot)[\w-]+/g)||[]).map(value=>`${file}: ${value}`));
  assert.deepEqual(staleStatus,[]);
});
test('semantic families define fg, bg and border for both themes',()=>{
  const tokens=readFileSync('src/tokens.css','utf8');
  for(const family of ['success','warning','danger','info','review','running'])for(const step of ['fg','bg','border'])assert.match(tokens,new RegExp(`--${family}-${step}:`),`${family}-${step}`);
  const light=tokens.match(/:root\[data-theme=light\]\{([^}]*)\}/)?.[1]||'';
  for(const family of ['success','warning','danger','info','review'])assert.match(light,new RegExp(`--${family}-fg:#`),`light ${family}-fg`);
  for(const alias of ['--border:','--error:','--danger:','--input:','--status-running:var(--running-fg)'])assert.ok(tokens.includes(alias),alias);
});
