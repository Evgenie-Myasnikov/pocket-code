import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
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
 if(!DesktopReadPolicy.Allows("/task-text/providers")||DesktopReadPolicy.AllowsWrite("/task-text/providers")||
    !DesktopReadPolicy.AllowsWrite("/task-text/improve")||DesktopReadPolicy.Allows("/task-text/improve"))
 throw new Exception("Unexpected task text route policy");
 string chain="/task-chains/12345678-1234-4123-8123-123456789abc";
 if(!DesktopReadPolicy.Allows("/task-chains?cwd=sample")||!DesktopReadPolicy.Allows(chain)||
    !DesktopReadPolicy.AllowsWrite("/task-chains")||!DesktopReadPolicy.AllowsWrite(chain+"/stop")||
    DesktopReadPolicy.Allows(chain+"/stop")||DesktopReadPolicy.AllowsWrite(chain)||DesktopReadPolicy.AllowsWrite(chain+"/delete"))
 throw new Exception("Unexpected task chain route policy");
if(!DesktopReadPolicy.AllowsWrite("/project-board/view")||!DesktopReadPolicy.Allows("/project-board/mcp/status?root=synthetic")||!DesktopReadPolicy.Allows("/project-board/views?root=synthetic")||!DesktopReadPolicy.AllowsWrite("/project-board/mcp")||!DesktopReadPolicy.Allows("/project-board/live?root=synthetic&after=synthetic&wait=1000"))throw new Exception("Live reads denied");foreach(var route in new[]{"/project-board/activity","/project-board/live/extra","/project-board/live#fragment"})if(DesktopReadPolicy.Allows(route))throw new Exception("Unexpected read route");if(DesktopReadPolicy.AllowsWrite("/project-board/views")||DesktopReadPolicy.AllowsWrite("/project-board/view/command")||DesktopReadPolicy.AllowsWrite("/project-board/mcp/status")||DesktopReadPolicy.AllowsWrite("/project-board/live")||DesktopReadPolicy.AllowsWrite("/project-board/activity"))throw new Exception("Unexpected write route");Console.WriteLine("Live route policy passed");return 0;}}`;
  const file=path.join(root,'Probe.cs'),exe=path.join(root,'Probe.exe');writeFileSync(file,code);
  try{execFileSync(path.join(process.env.WINDIR!,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/out:'+exe,file]);}catch(error){throw new Error(String((error as any).stdout));}
  assert.match(execFileSync(exe,{encoding:'utf8'}),/Live route policy passed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
