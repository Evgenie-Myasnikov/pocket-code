// Reproducible launcher assets from the shared vector; no network or user data.
import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const svg=await readFile(path.join(root,'public/pocket-code.svg'),'utf8');
const browser=await chromium.launch({executablePath:process.env.POCKET_TEST_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const page=await browser.newPage({deviceScaleFactor:1});
 async function png(size,foreground=false){await page.setViewportSize({width:size,height:size});const art=foreground?svg.replace(/<rect[^>]+\/>/,'').replace('viewBox="0 0 512 512"','viewBox="-128 -128 768 768"'):svg;await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:100vw;height:100vh;display:block}</style>${art}`);return page.screenshot({omitBackground:true});}
 const sizes=[16,24,32,48,64,128,256],images=[];
 for(const size of sizes)images.push(await png(size));
 const header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
 images.forEach((bytes,i)=>{const p=6+i*16;header[p]=header[p+1]=sizes[i]===256?0:sizes[i];header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(bytes.length,p+8);header.writeUInt32LE(offset,p+12);offset+=bytes.length;});
 await writeFile(path.join(root,'desktop/PocketCode.ico'),Buffer.concat([header,...images]));
 await writeFile(path.join(root,'public/pocket-code.png'),await png(512));
 for(const [density,size,fg] of [['mdpi',48,108],['hdpi',72,162],['xhdpi',96,216],['xxhdpi',144,324],['xxxhdpi',192,432]]){
  const folder=path.join(root,'android/app/src/main/res','mipmap-'+density);await mkdir(folder,{recursive:true});
  for(const name of ['ic_launcher.png','ic_launcher_round.png'])await writeFile(path.join(folder,name),await png(size));
  await writeFile(path.join(folder,'ic_launcher_foreground.png'),await png(fg,true));
 }
}finally{await browser.close();}
console.log('Shared Windows and Android icons generated.');
