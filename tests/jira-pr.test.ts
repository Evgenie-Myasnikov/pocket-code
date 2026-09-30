import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,access,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {JiraPullRequests,type PrCommandRunner} from '../server/jira-pr';

const sha='a'.repeat(40),otherSha='b'.repeat(40);
const input={title:'TASK-12: Improve layout',body:'A literal $(command) and `text`.\n\nSecond paragraph.',base:'main',head:'codex/TASK-12',headSha:sha};
const existing={url:'https://github.com/example/project/pull/7',number:7,headRepository:{name:'project'},headRepositoryOwner:{login:'example'},headRefName:input.head,baseRefName:input.base};
const execute=promisify(execFile);
async function temporary() {return mkdtemp(path.join(os.tmpdir(),'pocket-jira-pr-test-'));}
async function cleanup(root:string) {
  assert.equal(path.resolve(path.dirname(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('pocket-jira-pr-test-'));
  await rm(root,{recursive:true,force:true});
}
type Settings={dirty?:boolean;detached?:boolean;head?:string;sha?:string;origin?:string;pushOrigin?:string;files?:string[];commits?:number;baseMissing?:boolean;existing?:unknown[];failCreate?:boolean;failPush?:boolean;failLookup?:boolean;badCreateOutput?:boolean;root?:string;filters?:string;failure?:string};
function fixture(cwd:string,settings:Settings={}) {
  const calls:{command:string;args:string[]}[]=[];let body='',bodyFile='',created=false;
  const run:PrCommandRunner=async(command,args)=>{
    calls.push({command,args:[...args]});
    if(settings.failure)throw new Error(settings.failure);
    let output='';
    if(command==='git') {
      const a:string[]=[];for(let i=0;i<args.length;i++){if(args[i]==='-c'){i++;continue;}if(args[i]!=='--no-optional-locks')a.push(args[i]);}
      if(a[0]==='rev-parse'&&a[1]==='--show-toplevel')output=settings.root||cwd;
      else if(a[0]==='config')output=settings.filters||'';
      else if(a[0]==='status')output=settings.dirty?' M src/file.ts\0':'';
      else if(a[0]==='symbolic-ref'){if(settings.detached)throw new Error('detached');output=settings.head||input.head;}
      else if(a[0]==='check-ref-format')output=a[2];
      else if(a[0]==='rev-parse'){if(settings.baseMissing&&a[2].startsWith('refs/remotes'))throw new Error('missing');output=settings.sha||sha;}
      else if(a[0]==='remote')output=a.includes('--push')?settings.pushOrigin||settings.origin||'git@github.com:example/project.git':settings.origin||'https://github.com/example/project.git';
      else if(a[0]==='diff')output=(settings.files||['src/file.ts','src/with a space.ts']).join('\0')+'\0';
      else if(a[0]==='rev-list')output=String(settings.commits??2);
      else if(a[0]==='push'){if(settings.failPush)throw new Error('push token=private https://secret@github.com/private/repo.git');}
      else throw new Error('Unexpected synthetic Git command');
    }else if(command==='gh') {
      if(args[0]==='repo')output=JSON.stringify({defaultBranchRef:{name:'main'}});
      else if(args[1]==='list'){if(settings.failLookup)throw new Error('private remote lookup failure');output=JSON.stringify(created?[existing]:(settings.existing||[]));}
      else if(args[1]==='create') {
        bodyFile=args[args.indexOf('--body-file')+1];body=await readFile(bodyFile,'utf8');created=true;
        if(settings.failCreate)throw new Error('lost response with private token');
        output=settings.badCreateOutput?'Unexpected remote output':existing.url;
      }else throw new Error('Unexpected synthetic GitHub command');
    }else throw new Error('Unexpected executable');
    return {stdout:output};
  };
  return {helper:new JiraPullRequests({run}),calls,getBody:()=>body,getBodyFile:()=>bodyFile};
}

test('PR preview shows committed files and performs only read commands',async()=>{
  const cwd=await temporary();try {
    const f=fixture(cwd),result=await f.helper.preview(cwd,'TASK-12');
    assert.equal(result.ready,true);assert.equal(result.base,'main');assert.equal(result.head,input.head);assert.equal(result.headSha,sha);
    assert.deepEqual(result.files,['src/file.ts','src/with a space.ts']);assert.equal(result.commits,2);
    assert(!f.calls.some(c=>c.args.includes('push')||c.args.includes('create')||c.args.includes('commit')||c.args.includes('add')));
  }finally{await cleanup(cwd);}
});
test('PR preview rejects unsafe publication states before any mutation',async()=>{
  const cwd=await temporary();try {
    const child=path.join(cwd,'child');await mkdir(child);
    const cases:[Settings,RegExp,string?][]=[
      [{dirty:true},/commit task changes/], [{detached:true},/detached/], [{head:'main'},/default branch/],
      [{files:[]},/no committed/], [{commits:0},/no committed/], [{baseMissing:true},/Fetch origin/],
      [{origin:'https://token@github.com/example/project.git'},/without embedded credentials/],
      [{origin:'https://gitlab.com/example/project'},/GitHub repository/],
      [{pushOrigin:'https://github.com/other/project.git'},/same GitHub repository/],
      [{pushOrigin:'https://github.com/example/project.git\nhttps://github.com/other/project.git'},/exactly one/],
      [{root:cwd},/exact Git repository root/,child],
    ];
    for(const [settings,reason,folder]of cases){const f=fixture(folder||cwd,settings),result=await f.helper.preview(folder||cwd,'TASK-12');assert.equal(result.ready,false);assert.match(result.reason!,reason);assert(!f.calls.some(c=>c.args.includes('push')));}
  }finally{await cleanup(cwd);}
});
test('PR create rejects stale head, SHA and base rather than publishing changed work',async()=>{
  const cwd=await temporary();try {
    for(const change of [{head:'codex/another-task'},{headSha:otherSha},{base:'develop'}]){
      const f=fixture(cwd);await assert.rejects(f.helper.create(cwd,'TASK-12',{...input,...change}),/changed after the preview/);assert(!f.calls.some(c=>c.args.includes('push')));
    }
  }finally{await cleanup(cwd);}
});
test('PR create pushes only the approved SHA without hooks, writes an exact body file and removes it',async()=>{
  const cwd=await temporary();try {
    const f=fixture(cwd,{filters:'filter.custom.clean\0filter.custom.process\0filter.custom.required\0'});
    assert.deepEqual(await f.helper.create(cwd,'TASK-12',input),{url:existing.url,number:7});
    const push=f.calls.find(c=>c.command==='git'&&c.args.includes('push'))!;
    assert(push.args.includes('git@github.com:example/project.git'));assert(!push.args.includes('origin'));assert(push.args.includes('push.pushOption='));
    assert(push.args.includes(`${sha}:refs/heads/${input.head}`));assert(push.args.includes('--no-verify'));assert(push.args.includes('core.hooksPath=/dev/null'));assert(push.args.includes('--no-follow-tags'));assert(push.args.includes('--recurse-submodules=no'));
    assert(!push.args.some(a=>a==='--force'||a==='--all'||a==='--mirror'||a.startsWith('+')));
    const status=f.calls.find(c=>c.command==='git'&&c.args.includes('status'))!;
    assert(status.args.includes('filter.custom.clean='));assert(status.args.includes('filter.custom.process='));assert(status.args.includes('filter.custom.required=false'));
    const creation=f.calls.find(c=>c.command==='gh'&&c.args[1]==='create')!;
    assert(creation.args.includes('--head'));assert(creation.args.includes('github.com/example/project'));assert(!creation.args.includes('--fill'));assert.equal(f.getBody(),input.body);
    await assert.rejects(access(f.getBodyFile()));
  }finally{await cleanup(cwd);}
});
test('PR create reuses a verified existing PR after pushing its approved update',async()=>{
  const cwd=await temporary();try {
    const f=fixture(cwd,{existing:[existing]});
    assert.deepEqual(await f.helper.create(cwd,'TASK-12',input),{url:existing.url,number:7});
    assert.equal(f.calls.filter(c=>c.args.includes('push')).length,1);assert(!f.calls.some(c=>c.command==='gh'&&c.args[1]==='create'));
  }finally{await cleanup(cwd);}
});
test('PR create recovers a successfully created PR after a lost or malformed response',async()=>{
  const cwd=await temporary();try {
    for(const option of [{failCreate:true},{badCreateOutput:true}]){const f=fixture(cwd,option);assert.deepEqual(await f.helper.create(cwd,'TASK-12',input),{url:existing.url,number:7});assert.equal(f.calls.filter(c=>c.command==='gh'&&c.args[1]==='create').length,1);await assert.rejects(access(f.getBodyFile()));}
  }finally{await cleanup(cwd);}
});
test('PR helper never exposes command diagnostics or publishes after a rejected push',async()=>{
  const cwd=await temporary();try {
    const f=fixture(cwd,{failPush:true});await assert.rejects(f.helper.create(cwd,'TASK-12',input),error=>error instanceof Error&&!/private|secret|https:/.test(error.message));assert(!f.calls.some(c=>c.command==='gh'&&c.args[1]==='create'));
    const preview=await fixture(cwd,{failure:'token=private https://secret@github.com/private/repo'}).helper.preview(cwd,'TASK-12');assert.equal(preview.ready,false);assert(!/private|secret|https:/.test(preview.reason!));
  }finally{await cleanup(cwd);}
});
test('PR helper rejects mismatched existing PR repository, branch, base or URL',async()=>{
  const cwd=await temporary();try {
    for(const item of [{...existing,url:'https://evil.invalid/pull/7'},{...existing,headRepositoryOwner:{login:'attacker'}},{...existing,headRefName:'other'},{...existing,baseRefName:'develop'}]){
      const result=await fixture(cwd,{existing:[item]}).helper.preview(cwd,'TASK-12');assert.equal(result.ready,false);assert.match(result.reason!,/verify the existing/);
    }
  }finally{await cleanup(cwd);}
});
test('PR reconciliation finds the original PR with a dirty tree and a different current branch without mutation',async()=>{
  const cwd=await temporary();try {
    const f=fixture(cwd,{dirty:true,head:'codex/next-task',sha:otherSha,existing:[existing]});
    assert.deepEqual(await f.helper.reconcile(cwd,'TASK-12',input.base,input.head),{url:existing.url,number:7});
    assert(!f.calls.some(c=>c.args.some(arg=>['status','symbolic-ref','push','checkout','create','commit','add','diff'].includes(arg))));
    assert.equal(f.calls.filter(c=>c.command==='gh').length,1);
  }finally{await cleanup(cwd);}
});
test('PR reconciliation distinguishes no matching PR from a failed lookup',async()=>{
  const cwd=await temporary();try {
    assert.equal(await fixture(cwd).helper.reconcile(cwd,'TASK-12',input.base,input.head),undefined);
    const f=fixture(cwd,{failLookup:true});
    await assert.rejects(f.helper.reconcile(cwd,'TASK-12',input.base,input.head),error=>error instanceof Error&&/Could not verify whether/.test(error.message)&&!/private/.test(error.message));
    assert(!f.calls.some(c=>c.args.includes('push')));
  }finally{await cleanup(cwd);}
});
test('actual Git preview rejects a selected subfolder of an ancestor repository',async()=>{
  const cwd=await temporary();try {
    await execute('git',['init'],{cwd,windowsHide:true});const child=path.join(cwd,'selected');await mkdir(child);
    const run:PrCommandRunner=async(command,args,options)=>{assert.equal(command,'git');const result=await execute(command,args,{...options,windowsHide:true});return {stdout:result.stdout};};
    const result=await new JiraPullRequests({run}).preview(child,'TASK-12');assert.equal(result.ready,false);assert.match(result.reason!,/exact Git repository root/);
  }finally{await cleanup(cwd);}
});
test('actual Git preview reads a clean task diff and disables a configured clean filter',async()=>{
  const cwd=await temporary();
  const git=async(...args:string[])=>execute('git',['-c','core.hooksPath=/dev/null',...args],{cwd,windowsHide:true});
  try {
    await git('init','--initial-branch=main');await git('config','user.name','Fixture');await git('config','user.email','fixture@example.invalid');
    await writeFile(path.join(cwd,'sample.txt'),'before\n');await git('add','sample.txt');await git('commit','-m','Fixture base');
    await git('update-ref','refs/remotes/origin/main','HEAD');await git('checkout','-b',input.head);
    await writeFile(path.join(cwd,'sample.txt'),'after\n');await git('add','sample.txt');await git('commit','-m','Fixture task');
    await git('remote','add','origin','https://github.com/example/project.git');
    const run:PrCommandRunner=async(command,args,options)=>{
      if(command==='gh')return {stdout:args[0]==='repo'?JSON.stringify({defaultBranchRef:{name:'main'}}):'[]'};
      assert(!args.includes('push'));const result=await execute(command,args,{...options,windowsHide:true});return {stdout:result.stdout};
    };
    const helper=new JiraPullRequests({run}),preview=await helper.preview(cwd,'TASK-12');
    assert.equal(preview.ready,true,preview.reason||'Expected a clean task preview');assert.deepEqual(preview.files,['sample.txt']);assert.equal(preview.commits,1);
    await writeFile(path.join(cwd,'.git','filter.cjs'),"require('fs').writeFileSync('.git/filter-ran','unexpected');process.stdin.pipe(process.stdout)");
    await writeFile(path.join(cwd,'.git','info','attributes'),'sample.txt filter=probe\n');
    await git('config','filter.probe.clean','node .git/filter.cjs');await git('config','filter.probe.required','true');
    await writeFile(path.join(cwd,'sample.txt'),'changed again\n');
    const dirty=await helper.preview(cwd,'TASK-12');assert.equal(dirty.ready,false);assert.match(dirty.reason!,/commit task changes/);
    await assert.rejects(access(path.join(cwd,'.git','filter-ran')));
  }finally{await cleanup(cwd);}
});
