import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';

// A Cyrillic string saved in the wrong code page turns into "????" or U+FFFD. Both must fail the build, not reach users.
function files(dir:string):string[]{
  return readdirSync(dir).flatMap(name=>{const full=path.join(dir,name);return statSync(full).isDirectory()?files(full):/\.(tsx?|css|mjs)$/.test(name)?[full]:[];});
}
test('interface strings keep their Cyrillic: no "???" in t() keys or translations and no replacement characters',()=>{
  const problems:string[]=[];
  for(const file of [...files('src'),...files('server')]){
    const text=readFileSync(file,'utf8');
    if(text.includes('�'))problems.push(`${file}: replacement character U+FFFD`);
    for(const match of text.matchAll(/\bt\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g))if(/\?{3}/.test(match[2]))problems.push(`${file}: t(${match[1]}${match[2].slice(0,40)}…)`);
  }
  const translations=readFileSync('src/translations.ts','utf8');
  for(const line of translations.split(/\r?\n/))if(/\?{3}/.test(line))problems.push(`src/translations.ts: ${line.trim().slice(0,60)}`);
  assert.deepEqual(problems,[]);
});
