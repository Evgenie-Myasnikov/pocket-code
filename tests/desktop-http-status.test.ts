import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('Windows host replies retain HTTP status without becoming connectivity failures',{skip:process.platform!=='win32'},()=>{
 const source=readFileSync('desktop/DesktopWindow.cs','utf8');
 const failure=source.slice(source.indexOf('public sealed class DesktopBridgeFailure:'),source.indexOf('public sealed class PocketDesktop:'));
 const send=source.slice(source.indexOf('    async Task<object> Send('),source.indexOf('    Task<object> Request('));
 assert.match(source,/error=error.Message,code=error.Code,status=error.Status/);
 const root=mkdtempSync(path.join(tmpdir(),'pocket-bridge-test-'));
 try{
  writeFileSync(path.join(root,'connection-key.txt'),'synthetic-bridge-token');
  const code=`using System;using System.Text;using System.Collections.Generic;using System.IO;using System.Net;using System.Net.Http;using System.Threading;using System.Threading.Tasks;using System.Web.Script.Serialization;
${failure}
class Handler:HttpMessageHandler {public int Status;protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r,CancellationToken c){if(Status==0)throw new HttpRequestException();if(Status==1)throw new TaskCanceledException();return Task.FromResult(new HttpResponseMessage((HttpStatusCode)Status){Content=new StringContent(Status==200?"{\\"ok\\":true}":"{\\"error\\":\\"Synthetic rejection\\"}")});}}
class Probe {string storage;JavaScriptSerializer json=new JavaScriptSerializer();Probe(string root){storage=root;}
${send}
public static int Main(string[] args){var probe=new Probe(args[0]);foreach(int status in new[]{200,404,403,409,500,0,1}){try{probe.Send(new HttpClient(new Handler{Status=status}),"/synthetic",false).GetAwaiter().GetResult();if(status!=200)throw new Exception("Missing rejection");}catch(DesktopBridgeFailure e){if(status>=400){if(e.Status!=status||e.Code!="host_response"||e.Message!="Synthetic rejection")throw new Exception("Lost response status");}else if(e.Status!=null||e.Code!=(status==0?"host_unreachable":"host_timeout"))throw new Exception("Lost network classification");}}Console.WriteLine("7 bridge outcomes passed");return 0;}}`;
  const file=path.join(root,'Probe.cs'),exe=path.join(root,'Probe.exe');writeFileSync(file,code);
  try{execFileSync(path.join(process.env.WINDIR!,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/r:System.Net.Http.dll','/r:System.Web.Extensions.dll','/out:'+exe,file]);}catch(error){throw new Error(String((error as any).stdout));}
  assert.match(execFileSync(exe,[root],{encoding:'utf8'}),/7 bridge outcomes passed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('Windows read policy permits live board events but not activity writes',{skip:process.platform!=='win32'},()=>{
 const source=readFileSync('desktop/DesktopWindow.cs','utf8'),begin=source.indexOf('public static class DesktopReadPolicy'),end=source.indexOf('public sealed class DesktopBridgeFailure:');
 const root=mkdtempSync(path.join(tmpdir(),'pocket-policy-test-'));
 try{
  const code=`using System;using System.Text.RegularExpressions;
${source.slice(begin,end)}
class Probe {public static int Main(){if(!DesktopReadPolicy.AllowsWrite("/project-board/view")||!DesktopReadPolicy.Allows("/project-board/mcp/status?root=synthetic")||!DesktopReadPolicy.Allows("/project-board/views?root=synthetic")||!DesktopReadPolicy.AllowsWrite("/project-board/mcp")||!DesktopReadPolicy.Allows("/project-board/live?root=synthetic&after=synthetic&wait=1000"))throw new Exception("Live reads denied");foreach(var route in new[]{"/project-board/activity","/project-board/live/extra","/project-board/live#fragment"})if(DesktopReadPolicy.Allows(route))throw new Exception("Unexpected read route");if(DesktopReadPolicy.AllowsWrite("/project-board/views")||DesktopReadPolicy.AllowsWrite("/project-board/view/command")||DesktopReadPolicy.AllowsWrite("/project-board/mcp/status")||DesktopReadPolicy.AllowsWrite("/project-board/live")||DesktopReadPolicy.AllowsWrite("/project-board/activity"))throw new Exception("Unexpected write route");Console.WriteLine("Live route policy passed");return 0;}}`;
  const file=path.join(root,'Probe.cs'),exe=path.join(root,'Probe.exe');writeFileSync(file,code);
  try{execFileSync(path.join(process.env.WINDIR!,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/out:'+exe,file]);}catch(error){throw new Error(String((error as any).stdout));}
  assert.match(execFileSync(exe,{encoding:'utf8'}),/Live route policy passed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
