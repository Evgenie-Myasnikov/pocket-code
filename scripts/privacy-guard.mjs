import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function checkContent(name,bytes,deny=[]){
  const findings=[];
  if(/(^|\/)(?:\.env(?:\..*)?|\.privacy-denylist\.local\.json|connection-key\.txt|credentials[^/]*|auth\.json|\.npmrc)$|\.(?:pem|p12|pfx|jks|keystore|log)$/i.test(name)||/(^|\/)(?:\.pocket-code|uploads|\.local|node_modules)(\/|$)/.test(name))findings.push('private-file');
  for(const encoding of ['utf8','utf16le']){
    const text=bytes.toString(encoding);
    if(/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(text))findings.push('private-key');
    if(/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk-ant-[A-Za-z0-9_-]{30,}|AKIA[A-Z0-9]{16})\b/.test(text))findings.push('credential');
    if(deny.some(value=>text.toLowerCase().includes(value.toLowerCase())))findings.push('local-private-value');
  }
  return [...new Set(findings)];
}

export function run(args,git=(...args)=>execFileSync('git',args,{maxBuffer:128*1024*1024})){
  const root=git('rev-parse','--show-toplevel').toString().trim();
  if(path.resolve(root)!==path.resolve(process.cwd()))throw Error('Run from the actual repository root; parent repositories are refused');
  let configured;
  try{configured=git('config','--get','pocket.privacyDenylist').toString().trim();}catch(error){if(error.status!==1)throw error;}
  const external=process.env.POCKET_PRIVACY_DENYLIST||configured;
  const denyFile=external||path.join(root,'.privacy-denylist.local.json');
  let deny=[];
  if(external||existsSync(denyFile)){
    deny=JSON.parse(readFileSync(denyFile,'utf8').replace(/^\uFEFF/,''));
    if(!Array.isArray(deny)||deny.some(value=>typeof value!=='string'||value.length<4))throw Error('Invalid local denylist');
  }
  const mode=args[0],revision=args[1];let files=[],failures=0;
  if(mode==='--staged')files=git('ls-files','--stage','-z').toString().split('\0').filter(Boolean).map(line=>{const match=/^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/.exec(line);if(!match||match[3]!=='0')throw Error('Unmerged index');return{mode:match[1],oid:match[2],name:match[4]};});
  else if(mode==='--tree'&&revision&&!revision.startsWith('-')){
    const sha=git('rev-parse','--verify',revision+'^{commit}').toString().trim();
    files=git('ls-tree','-rz',sha).toString().split('\0').filter(Boolean).map(line=>{const match=/^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(line);if(!match)throw Error('Invalid Git tree');return{mode:match[1],oid:match[3],name:match[4]};});
    if(checkContent('commit',git('show','-s','--format=%B%n%an%n%ae%n%cn%n%ce',sha),deny).length){console.error('Privacy guard: commit metadata rejected');failures++;}
  }else throw Error('Use --staged or --tree <commit>');
  for(const [index,file]of files.entries()){
    const issues=file.mode==='100644'||file.mode==='100755'?checkContent(file.name,git('cat-file','blob',file.oid),deny):['unsupported-file-mode'];
    if(issues.length){failures++;console.error(`Privacy guard: entry ${index+1} rejected (${issues.join(', ')}). Values and paths are redacted.`);}
  }
  if(failures)throw Error('Publication blocked by privacy guard');
  console.log(`Privacy guard passed: ${files.length} Git entries checked. Images and archives require separate review.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{run(process.argv.slice(2));}catch(error){console.error(error?.message?.startsWith('Publication blocked')?error.message:'Privacy guard could not complete; publication blocked. Check the repository, Git and local denylist.');process.exitCode=1;}
