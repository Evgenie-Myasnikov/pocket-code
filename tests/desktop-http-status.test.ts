import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,symlinkSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('Explorer only receives a verified local directory as one argument',{skip:process.platform!=='win32'},()=>{
 const source=readFileSync('desktop/DesktopWindow.cs','utf8');
 const policy=source.slice(source.indexOf('public static class DesktopProjectFolder'),source.indexOf('public static class DesktopReadPolicy'));
 const work=mkdtempSync(path.join(tmpdir(),'pocket-explorer-test-')),project=path.join(work,'Project & Demo');
 try{
   const output=path.join(project,'build output'),outside=path.join(work,'Project & Demo Two'),link=path.join(project,'redirect');
   mkdirSync(output,{recursive:true});mkdirSync(outside);symlinkSync(outside,link,'junction');
   const file=path.join(work,'Probe.cs'),exe=path.join(work,'Probe.exe');
   const probe=String.raw`
using System;using System.IO;using System.Diagnostics;using System.Text.RegularExpressions;
${policy}
public class Probe{
 static void Reject(Action action){try{action();}catch(ArgumentException){return;}catch(IOException){return;}throw new Exception("Unexpected folder accepted");}
 public static int Main(string[] args){
  string root=args[0],folder=args[1];
  if(DesktopProjectFolder.ScopedRead(root,folder)!="/files?cwd="+Uri.EscapeDataString(root)+"&path="+Uri.EscapeDataString(folder))throw new Exception("Missing project scope");
  foreach(string target in new[]{args[2],@"\\host\share",@"\\?\C:\folder",@"\\.\C:\folder",@"shell:downloads",@"child",@"C:relative",Path.Combine(root,"..","other"),root+"\\bad\"name",root+"\\bad\nname",root+"\\file:stream",root+"\\NUL"})
    Reject(()=>DesktopProjectFolder.ScopedRead(root,target));
  Reject(()=>DesktopProjectFolder.Explorer(args[3]));
  Reject(()=>DesktopProjectFolder.Explorer(Path.Combine(root,"missing")));Reject(()=>DesktopProjectFolder.Explorer(args[4]));
  foreach(string target in new[]{folder,Path.GetPathRoot(root)}){
    var start=DesktopProjectFolder.Explorer(target);
    if(start.UseShellExecute||start.FileName!=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"explorer.exe")
      ||start.Arguments!=(target.Length==3?target:"\""+target+"\""))throw new Exception("Incorrect Explorer arguments");
  }
  Console.WriteLine("Scoped directories passed");return 0;
 }
}`;
   writeFileSync(file,probe);
   const compiler=path.join(process.env.WINDIR!,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
   execFileSync(compiler,['/nologo','/out:'+exe,file]);
   assert.match(execFileSync(exe,[project,output,outside,link,file],{encoding:'utf8'}),/Scoped directories passed/);
 }finally{rmSync(work,{recursive:true,force:true});}
});
test('Windows host replies retain HTTP status without becoming connectivity failures',{skip:process.platform!=='win32'},()=>{
 const source=readFileSync('desktop/DesktopWindow.cs','utf8');
 const preferences=source.slice(source.indexOf('public sealed class DesktopPreferences'),source.indexOf('public static class DesktopRunAlertBatch'));
 const failure=source.slice(source.indexOf('public sealed class DesktopBridgeFailure:'),source.indexOf('public sealed class PocketDesktop:'));
 const send=source.slice(source.indexOf('    async Task<object> Send('),source.indexOf('    Task<object> Request('));
 assert.match(source,/error=error.Message,code=error.Code,status=error.Status/);
 const root=mkdtempSync(path.join(tmpdir(),'pocket-bridge-test-'));
 try{
  writeFileSync(path.join(root,'connection-key.txt'),'synthetic-bridge-token');
  const code=`using System;using System.Text;using System.Collections.Generic;using System.IO;using System.Net;using System.Net.Http;using System.Threading;using System.Threading.Tasks;using System.Web.Script.Serialization;
${preferences}
${failure}
class Handler:HttpMessageHandler {public int Status;protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage r,CancellationToken c){if(Status==0)throw new HttpRequestException();if(Status==1)throw new TaskCanceledException();return Task.FromResult(new HttpResponseMessage((HttpStatusCode)Status){Content=new StringContent(Status==200?"{\\"ok\\":true}":"{\\"error\\":\\"Synthetic rejection\\"}")});}}
class Probe {
    string storage;
    JavaScriptSerializer json=new JavaScriptSerializer();
    DesktopPreferences preferences=new DesktopPreferences();
    Probe(string root){storage=root;}
${send}
    void ExpectOutcome(int status,string code=null,int? httpStatus=null){
        using(var client=new HttpClient(new Handler{Status=status})){
            try{
                Send(client,"/synthetic",false).GetAwaiter().GetResult();
                if(code!=null)throw new Exception("Missing rejection: "+code);
            }catch(DesktopBridgeFailure e){
                if(e.Status!=httpStatus||e.Code!=code)throw new Exception("Unexpected bridge outcome: "+e.Code);
                if(httpStatus.HasValue&&e.Message!="Synthetic rejection")throw new Exception("Lost response message");
            }
        }
    }
    public static int Main(string[] args){
        var probe=new Probe(args[0]);
        probe.ExpectOutcome(200);
        foreach(int status in new[]{404,403,409,500})probe.ExpectOutcome(status,"host_response",status);
        probe.preferences.Connect=true;
        probe.ExpectOutcome(0,"host_unreachable");
        probe.ExpectOutcome(1,"host_timeout");
        probe.preferences.Connect=false;
        probe.ExpectOutcome(0,"host_unreachable");
        Console.WriteLine("8 bridge outcomes passed");
        return 0;
    }
}`;
  const file=path.join(root,'Probe.cs'),exe=path.join(root,'Probe.exe');writeFileSync(file,code);
  try{execFileSync(path.join(process.env.WINDIR!,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/r:System.Net.Http.dll','/r:System.Web.Extensions.dll','/out:'+exe,file]);}catch(error){throw new Error(String((error as any).stdout));}
  assert.match(execFileSync(exe,[root],{encoding:'utf8'}),/8 bridge outcomes passed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('Windows read policy permits live board events but not activity writes',{skip:process.platform!=='win32'},()=>{
 const source=readFileSync('desktop/DesktopWindow.cs','utf8'),begin=source.indexOf('public static class DesktopReadPolicy'),end=source.indexOf('public sealed class DesktopBridgeFailure:');
 const root=mkdtempSync(path.join(tmpdir(),'pocket-policy-test-'));
 try{
  const code=`using System;using System.Text.RegularExpressions;
${source.slice(begin,end)}
class Probe {public static int Main(){
 string job="/jobs/12345678-1234-4123-8123-123456789abc";
 string message=job+"/messages/abcdef12-1234-4123-8123-123456789abc";
 string metrics="/sessions/abcdef12-1234-4123-8123-123456789abc/generation";
 if(!DesktopReadPolicy.Allows(metrics+"?provider=codex")||DesktopReadPolicy.AllowsWrite(metrics)||DesktopReadPolicy.Allows(metrics+"/extra"))throw new Exception("Generation statistics must be read-only");
 if(!DesktopReadPolicy.AllowsWrite("/chat-library/bulk-delete")||DesktopReadPolicy.Allows("/chat-library/bulk-delete")||DesktopReadPolicy.AllowsWrite("/chat-library/bulk-delete/extra"))throw new Exception("Bulk delete route policy");
 if(!DesktopReadPolicy.Allows("/chat-library/erasures?offset=200")||DesktopReadPolicy.AllowsWrite("/chat-library/erasures")||DesktopReadPolicy.Allows("/chat-library/erasures/extra"))throw new Exception("Erasure feed must be read-only");
 if(!DesktopReadPolicy.AllowsWrite(message+"/cancel")||DesktopReadPolicy.Allows(message+"/cancel")||
    DesktopReadPolicy.AllowsWrite(message+"/cancel/extra")||DesktopReadPolicy.AllowsWrite(job+"/messages/not-an-id/cancel"))
 throw new Exception("Unexpected queued message cancel policy");
 if(!DesktopReadPolicy.Allows("/task-text/providers")||DesktopReadPolicy.AllowsWrite("/task-text/providers")||
    !DesktopReadPolicy.AllowsWrite("/task-text/improve")||DesktopReadPolicy.Allows("/task-text/improve"))
 throw new Exception("Unexpected task text route policy");
 foreach(string route in new[]{"/task-text/plan/providers","/files?path=C%3A%5CDemo","/file?path=C%3A%5CDemo%5Cguide.md"})
   if(!DesktopReadPolicy.Allows(route)||DesktopReadPolicy.AllowsWrite(route))throw new Exception("Planner source read policy");
 if(!DesktopReadPolicy.AllowsWrite("/task-text/plan")||DesktopReadPolicy.Allows("/task-text/plan")||
    DesktopReadPolicy.AllowsWrite("/task-text/plan/extra")||DesktopReadPolicy.Allows("/task-text/plan/providers/extra"))
   throw new Exception("Planner generation policy");
 string chain="/task-chains/12345678-1234-4123-8123-123456789abc";
 if(!DesktopReadPolicy.AllowsWrite(chain+"/delete-chats")||DesktopReadPolicy.Allows(chain+"/delete-chats")||DesktopReadPolicy.AllowsWrite(chain+"/delete-chats/extra"))throw new Exception("Chain erasure policy");
 if(!DesktopReadPolicy.Allows("/task-chains?cwd=sample")||!DesktopReadPolicy.Allows(chain)||
    !DesktopReadPolicy.AllowsWrite("/task-chains")||!DesktopReadPolicy.AllowsWrite(chain+"/stop")||
    !DesktopReadPolicy.AllowsWrite(chain+"/delete")||DesktopReadPolicy.Allows(chain+"/stop")||DesktopReadPolicy.Allows(chain+"/delete")||
    DesktopReadPolicy.AllowsWrite(chain)||DesktopReadPolicy.AllowsWrite(chain+"/delete/extra"))
 throw new Exception("Unexpected task chain route policy");
if(!DesktopReadPolicy.AllowsWrite("/project-board/view")||!DesktopReadPolicy.Allows("/project-board/mcp/status?root=synthetic")||!DesktopReadPolicy.Allows("/project-board/views?root=synthetic")||!DesktopReadPolicy.AllowsWrite("/project-board/mcp")||!DesktopReadPolicy.Allows("/project-board/live?root=synthetic&after=synthetic&wait=1000"))throw new Exception("Live reads denied");foreach(var route in new[]{"/project-board/activity","/project-board/live/extra","/project-board/live#fragment"})if(DesktopReadPolicy.Allows(route))throw new Exception("Unexpected read route");if(DesktopReadPolicy.AllowsWrite("/project-board/views")||DesktopReadPolicy.AllowsWrite("/project-board/view/command")||DesktopReadPolicy.AllowsWrite("/project-board/mcp/status")||DesktopReadPolicy.AllowsWrite("/project-board/live")||DesktopReadPolicy.AllowsWrite("/project-board/activity"))throw new Exception("Unexpected write route");Console.WriteLine("Live route policy passed");return 0;}}`;
  const file=path.join(root,'Probe.cs'),exe=path.join(root,'Probe.exe');writeFileSync(file,code);
  try{execFileSync(path.join(process.env.WINDIR!,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/out:'+exe,file]);}catch(error){throw new Error(String((error as any).stdout));}
  assert.match(execFileSync(exe,{encoding:'utf8'}),/Live route policy passed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
