import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';

/**
 * The browser keeps one invalidation set for all `:has()` rules. Whatever follows a `:has()` compound in any rule is
 * re-checked across the whole subtree of every element a `:has()` rule can match, on each change inside it. The window root
 * carries such rules, so a tag name there (`…:has(…) … svg`) made every icon in the window recalculate its style on each
 * key press and each streamed chunk. Selectors after `:has()` must name classes or attributes.
 */
test('no rule names a broad tag after :has()',async()=>{
  const allowed=new Set(['textarea','footer']);
  const found:string[]=[];
  for(const file of (await readdir('src')).filter(name=>name.endsWith('.css'))){
    const css=(await readFile(path.join('src',file),'utf8')).replace(/\/\*[\s\S]*?\*\//g,'');
    for(const rule of css.matchAll(/([^{}]+)\{/g))for(const part of rule[1].split(/,(?![^()]*\))/)){
      const selector=part.trim().replace(/\s+/g,' ');
      const start=selector.lastIndexOf(':has(');if(start<0)continue;
      let depth=0,end=start;
      for(;end<selector.length;end++){if(selector[end]==='(')depth++;else if(selector[end]===')'&&!--depth)break;}
      const tail=selector.slice(end+1);
      const tags=[...tail.matchAll(/(?:^|[\s>+~(,])([a-z][a-z0-9-]*|\*)(?=[\s>+~.:#\[),]|$)/g)].map(match=>match[1]).filter(tag=>!['is','not','where'].includes(tag)&&!allowed.has(tag));
      if(tags.length)found.push(`${file}: ${selector} → ${[...new Set(tags)].join(', ')}`);
    }
  }
  assert.deepEqual(found,[]);
});
