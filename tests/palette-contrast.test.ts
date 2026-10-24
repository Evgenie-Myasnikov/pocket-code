import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
function luminance(hex:string){const channels=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;}
function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('all named light and dark palettes keep readable text and primary buttons',()=>{
 const css=readFileSync('src/neutral-themes.css','utf8');
 const palettes=[...css.matchAll(/:root\[data-theme=(\w+)\]\[data-palette=(\w+)\]\{([^}]+)\}/g)];
 assert.equal(palettes.length,20);
 for(const [,mode,name,body] of palettes){const tokens=Object.fromEntries([...body.matchAll(/--([\w-]+):(#[a-f\d]{6});/g)].map(m=>[m[1],m[2]]));
  for(const fg of ['text','muted','accent'])for(const bg of ['bg','panel','surface'])assert.ok(contrast(tokens[fg],tokens[bg])>=4.5,`${mode}/${name}: ${fg} on ${bg}`);
  assert.ok(contrast(tokens.accent,tokens['accent-dark'])>=4.5,`${mode}/${name}: primary button`);
 }
});
