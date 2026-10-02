import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const gradle=await readFile(new URL('../android/app/build.gradle',import.meta.url),'utf8');
const versionCode=Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
if(!Number.isSafeInteger(versionCode)||!gradle.includes(`versionName "${version}"`))throw Error('Android and package versions differ');
const apk=`Pocket-Code-${version}.apk`,file=new URL('../artifacts/'+apk,import.meta.url);
const manifest={applicationId:'app.pocketcode.mobile',version,versionCode,apk,size:(await stat(file)).size,sha256:createHash('sha256').update(await readFile(file)).digest('hex')};
const hostAsset=`Pocket-Code-Host-${version}.json.gz`,hostFile=new URL('../artifacts/'+hostAsset,import.meta.url);
try { const bytes=await readFile(hostFile); manifest.host={protocol:1,asset:hostAsset,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}; }
catch(error) { if(error.code!=='ENOENT')throw error; }
const desktopAsset=`Pocket-Code-Desktop-${version}-win-x64.zip`;
try{const bytes=await readFile(new URL('../artifacts/'+desktopAsset,import.meta.url));manifest.desktop={protocol:1,asset:desktopAsset,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}catch(error){if(error.code!=='ENOENT')throw error;}
await writeFile(new URL('../artifacts/update.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
console.log('Release manifest generated.');
