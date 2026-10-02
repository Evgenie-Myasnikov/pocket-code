import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {loginScript,parseClaudeAuth,ProviderConnections} from '../server/provider-connections';

test('login scripts quote executable paths and parse without running credentials or commands',()=>{
 for(const [provider,method] of [['claude','sso'],['codex','device'],['codex','key'],['codex','accessToken'],['copilot','token']] as const){
  const script=loginScript("C:\\Demo's folder\\$name\\agent.exe",provider,method);
  assert.ok(script.includes("'C:\\Demo''s folder\\$name\\agent.exe'"));
  if(['key','token','accessToken'].includes(method)){assert.match(script,/-AsSecureString/);assert.match(script,/ZeroFreeBSTR/);assert.match(script,/\$plain \| &/);}
  if(process.platform==='win32'){const parser="$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseInput([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('"+Buffer.from(script,'utf16le').toString('base64')+"')),[ref]$t,[ref]$e)|Out-Null;if($e.Count){exit 1}";execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',parser],{windowsHide:true});}
 }
});
test('unrecognized login operations and inherited property names are rejected',()=>{
 for(const method of ['logout','browser; Remove-Item','constructor','__proto__'])assert.throws(()=>loginScript('agent.exe','codex',method));
});
test('Claude auth requires an explicit boolean, not process success or arbitrary output',()=>{
 assert.equal(parseClaudeAuth({code:0,stdout:'{"loggedIn":true,"email":"synthetic@example.invalid"}'}),true);
 assert.equal(parseClaudeAuth({code:1,stdout:'{"loggedIn":false}'}),false);
 assert.equal(parseClaudeAuth({code:0,stdout:'unknown CLI output'}),null);
 assert.equal(parseClaudeAuth({code:0,stdout:'{"loggedIn":"yes"}'}),null);
});
test('active work and closed hosts reject sign-in before spawning',async()=>{
 const service=new ProviderConnections({},()=>true,async()=>{});
 await assert.rejects(service.start('codex','browser'),/Finish active/);
 service.close();await assert.rejects(service.start('claude','browser'),/Host is stopping/);
});
