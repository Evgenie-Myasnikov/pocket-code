using System;
using System.IO;
using System.Drawing;
using System.Reflection;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

// Preview mode never reads pairing data, changes startup settings or contacts a host.
public static class DesktopSmoke {
    [System.Runtime.InteropServices.DllImport("user32.dll")] static extern bool PrintWindow(IntPtr window,IntPtr dc,uint flags);
    static void Check(bool value,string message){if(!value)throw new Exception(message);}
    static object Field(object target,string name){return target.GetType().GetField(name,BindingFlags.NonPublic|BindingFlags.Instance).GetValue(target);}
    static void Call(object target,string name){var task=(Task)target.GetType().GetMethod(name,BindingFlags.NonPublic|BindingFlags.Instance).Invoke(target,null);while(!task.IsCompleted){Application.DoEvents();Thread.Sleep(10);}task.GetAwaiter().GetResult();}
    [STAThread] public static int Main(string[] args){
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        PocketCodeOwnedHost owned=null;
        try{
            using(var form=new PocketDesktop(new[]{"--preview"},true)){
                form.Show();DateTime readyDeadline=DateTime.UtcNow.AddSeconds(20);while(!form.Ready.IsCompleted&&DateTime.UtcNow<readyDeadline){Application.DoEvents();Thread.Sleep(20);}Check(form.Ready.IsCompleted,"WebView loads");form.Ready.GetAwaiter().GetResult();Check(form.Visible,"Window opens");
                var ui=(Microsoft.Web.WebView2.WinForms.WebView2)Field(form,"web");bool rendered=false;var renderDeadline=DateTime.UtcNow.AddSeconds(15);
                while(!rendered&&DateTime.UtcNow<renderDeadline){var ready=ui.CoreWebView2.ExecuteScriptAsync("!!document.querySelector('.desktop-app')");while(!ready.IsCompleted){Application.DoEvents();Thread.Sleep(10);}rendered=ready.Result=="true";Application.DoEvents();Thread.Sleep(50);}Check(rendered,"Shared desktop interface renders");
                form.Close();Application.DoEvents();Check(!form.Visible&&!form.IsDisposed,"Close hides without exiting");
                form.RestoreWindow();Application.DoEvents();Check(form.Visible,"Tray open restores window");Check(ui.Focused||ui.ContainsFocus,"Restored WebView receives keyboard focus");
                form.WindowState=FormWindowState.Minimized;Application.DoEvents();Check(!form.Visible,"Minimize hides window");
                form.RestoreWindow();Application.DoEvents();Check(form.WindowState==FormWindowState.Normal,"Restored window is normal");
                var themeMethod=typeof(PocketDesktop).GetMethod("ApplyWindowTheme",BindingFlags.NonPublic|BindingFlags.Instance);
                themeMethod.Invoke(form,new object[]{false,Color.FromArgb(247,246,249),Color.FromArgb(30,26,40),Color.FromArgb(185,176,202)});
                Check(form.BackColor==Color.FromArgb(247,246,249),"Native window accepts light palette");
                themeMethod.Invoke(form,new object[]{true,Color.FromArgb(17,21,18),Color.FromArgb(230,232,227),Color.FromArgb(42,48,43)});
                if(args.Length>0){using(var bitmap=new Bitmap(form.Width,form.Height))using(var graphics=Graphics.FromImage(bitmap)){IntPtr dc=graphics.GetHdc();try{Check(PrintWindow(form.Handle,dc,2),"Native frame captured");}finally{graphics.ReleaseHdc(dc);}bitmap.Save(args[0],System.Drawing.Imaging.ImageFormat.Png);}}
                string powershell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe");
                owned=PocketCodeOwnedHost.Start(powershell,"-NoProfile -NonInteractive -Command \"Start-Sleep -Seconds 90\"",Environment.CurrentDirectory,true);
                using(var child=Process.GetProcessById(owned.ProcessId)){
                    Check(owned.Contains(child.Id),"Hidden child belongs to application job");
                    typeof(PocketDesktop).GetField("owner",BindingFlags.NonPublic|BindingFlags.Instance).SetValue(form,owned);
                    var exit=(Task)typeof(PocketDesktop).GetMethod("ExitApp",BindingFlags.NonPublic|BindingFlags.Instance).Invoke(form,null);
                    while(!exit.IsCompleted){Application.DoEvents();Thread.Sleep(10);}exit.GetAwaiter().GetResult();
                    Check(child.WaitForExit(5000),"Explicit exit terminates owned child");
                    Check(form.IsDisposed,"Explicit exit disposes window");owned=null;
                }
            }
            string temp=Path.Combine(Path.GetTempPath(),"pocket-desktop-test-"+Guid.NewGuid());
            string previous=Environment.GetEnvironmentVariable("POCKET_DATA_DIR");
            Directory.CreateDirectory(Path.Combine(temp,"scripts"));
            try{
                Environment.SetEnvironmentVariable("POCKET_DATA_DIR",temp);
                File.WriteAllText(Path.Combine(temp,"scripts","start.ps1"),"param([switch]$Desktop,[switch]$Internet)\n[Reflection.Assembly]::LoadFrom('"+typeof(PocketCodeOwnedHost).Assembly.Location.Replace("'","''")+"') | Out-Null\n$nested=[PocketCodeOwnedHost]::Start((Join-Path $PSHOME 'powershell.exe'),'-NoProfile -NonInteractive -Command \"Start-Sleep -Seconds 90\"',$PWD.Path,$true)\nSet-Content -LiteralPath (Join-Path $env:POCKET_DATA_DIR 'nested.pid') -Value $nested.ProcessId\ntry{Start-Sleep -Seconds 90}finally{$nested.Dispose()}");
                File.WriteAllText(Path.Combine(temp,"desktop.json"),"{\"Connect\":false,\"Internet\":false,\"AutoReconnect\":true}");
                // A handle without delete sharing makes File.Replace fail, as seen right after an update handoff.
                using(var locked=new FileStream(Path.Combine(temp,"desktop.json"),FileMode.Open,FileAccess.Read,FileShare.ReadWrite))
                using(var form=new PocketDesktop(new[]{"--source",temp},false)){
                    form.Show();var timer=(System.Windows.Forms.Timer)Field(form,"timer");DateTime deadline=DateTime.UtcNow.AddSeconds(20);
                    while(!timer.Enabled&&DateTime.UtcNow<deadline){Application.DoEvents();Thread.Sleep(20);}
                    Check(timer.Enabled,"Host polling starts when settings cannot be saved");
                    uint browser=((Microsoft.Web.WebView2.WinForms.WebView2)Field(form,"web")).CoreWebView2.BrowserProcessId;
                    Call(form,"ExitApp");
                    try{using(var process=Process.GetProcessById((int)browser))process.WaitForExit(10000);}catch(ArgumentException){/* Already exited. */}
                }
                Directory.CreateDirectory(Path.Combine(temp,"desktop-update"));
                foreach(bool wasVisible in new[]{true,false}){
                    string marker=Path.Combine(temp,"desktop-update","reopen.txt");if(wasVisible)File.WriteAllText(marker,"synthetic");
                    using(var form=new PocketDesktop(new[]{"--source",temp,"--updated","--background"},false)){
                        form.Show();var timer=(System.Windows.Forms.Timer)Field(form,"timer");DateTime deadline=DateTime.UtcNow.AddSeconds(20);
                        while(!timer.Enabled&&DateTime.UtcNow<deadline){Application.DoEvents();Thread.Sleep(20);}
                        Check(form.Visible==wasVisible,wasVisible?"Window reopens after an update when it was open":"Updated window stays in the tray when it was hidden");
                        Check(!File.Exists(marker),"Reopen marker is consumed");
                        uint browser=((Microsoft.Web.WebView2.WinForms.WebView2)Field(form,"web")).CoreWebView2.BrowserProcessId;
                        Call(form,"ExitApp");
                        try{using(var process=Process.GetProcessById((int)browser))process.WaitForExit(10000);}catch(ArgumentException){/* Already exited. */}
                    }
                }
                using(var form=new PocketDesktop(new[]{"--source",temp},false)){
                    using(var bitmap=new Bitmap(2,2))using(var image=new MemoryStream()){
                        bitmap.Save(image,System.Drawing.Imaging.ImageFormat.Png);
                        File.WriteAllText(Path.Combine(temp,"pairing.html"),"<img src=\"data:image/png;base64,"+Convert.ToBase64String(image.ToArray())+"\" alt=\"Synthetic\"><code>https://example.invalid</code><a href=\"http://127.0.0.1:4318/setup/jira#synthetic\">Jira</a>");
                    }
                    typeof(PocketDesktop).GetMethod("LoadPairing",BindingFlags.NonPublic|BindingFlags.Instance).Invoke(form,null);
                    Check(((object[])Field(form,"addresses")).Length==1,"Pairing image is available to shared UI");
                    Check(Field(form,"jiraUrl")!=null,"Local Jira setup is available");
                    Call(form,"Poll");Check(Field(form,"owner")==null,"Explicitly disconnected setting does not auto-start");
                    Call(form,"Toggle");Check(Field(form,"owner")!=null,"Manual connect launches hidden host");
                    Check(File.ReadAllText(Path.Combine(temp,"desktop.json")).Contains("\"Connect\":true"),"Connect intent is saved");
                    string nestedFile=Path.Combine(temp,"nested.pid");DateTime deadline=DateTime.UtcNow.AddSeconds(8);
                    while(!File.Exists(nestedFile)&&DateTime.UtcNow<deadline){Application.DoEvents();Thread.Sleep(50);}
                    Check(File.Exists(nestedFile),"Nested launcher job started");
                    using(var nested=Process.GetProcessById(Int32.Parse(File.ReadAllText(nestedFile).Trim()))){
                        Check(((PocketCodeOwnedHost)Field(form,"owner")).Contains(nested.Id),"Nested host also belongs to desktop job");
                        Call(form,"Toggle");Check(Field(form,"owner")==null,"Disconnect closes owned job");
                        Check(nested.WaitForExit(5000),"Disconnect closes nested host too");
                    }
                    Check(File.ReadAllText(Path.Combine(temp,"desktop.json")).Contains("\"Connect\":false"),"Disconnect intent is saved");
                    Call(form,"Poll");Check(Field(form,"owner")==null,"Disconnected host stays stopped");
                    Call(form,"Toggle");Call(form,"ExitApp");
                }
                using(var restored=new PocketDesktop(new[]{"--source",temp},false)){
                    Call(restored,"Poll");Check(Field(restored,"owner")!=null,"Last active connection resumes on next launch");Call(restored,"ExitApp");
                }
            }finally{
                Environment.SetEnvironmentVariable("POCKET_DATA_DIR",previous);
                Check(Path.GetFullPath(temp).StartsWith(Path.GetFullPath(Path.GetTempPath()),StringComparison.OrdinalIgnoreCase),"Fixture cleanup stays in temp");
                Directory.Delete(temp,true);
            }
            Check(DesktopReadPolicy.AllowsMiroResource("https://miro.com/app/live-embed/synthetic-board/",true),"Miro embed document allowed");
            Check(DesktopReadPolicy.AllowsMiroResource("https://mirostatic.com/app.js",false),"Miro assets allowed");
            Check(!DesktopReadPolicy.AllowsMiroResource("https://miro.com.evil.invalid/app/live-embed/synthetic/",true),"Lookalike Miro rejected");
            Check(!DesktopReadPolicy.AllowsMiroResource("https://example.com/script.js",false),"Unrelated scripts blocked");
            foreach(string path in new[]{"/project-board?root=example","/sessions","/sessions/synthetic/messages?provider=codex","/review?cwd=example","/project-artifact?path=example.md","/project-docs?cwd=example","/project-doc?cwd=example&path=AGENTS.md","/files?path=example","/file?path=example/README.md","/sessions/synthetic/subagents/child/messages"})Check(DesktopReadPolicy.Allows(path),"Read route allowed");
            foreach(string path in new[]{"/runtime/stop","/jobs/example/stop","/files/upload","/file/write","https://example.invalid","//example.invalid","/../runtime/stop","/sessions/x/messages#hidden","/jira/login"})Check(!DesktopReadPolicy.Allows(path),"Unsafe route denied");
            foreach(string path in new[]{"/project-board","/project-board/create","/project-board/delete","/project-board/miro","/jobs","/uploads","/jobs/11111111-1111-4111-8111-111111111111/messages","/workspaces","/workspaces/11111111-1111-4111-8111-111111111111/delete","/boards/11111111-1111-4111-8111-111111111111/delete","/boards/11111111-1111-4111-8111-111111111111","/boards/11111111-1111-4111-8111-111111111111/branch"})Check(DesktopReadPolicy.AllowsWrite(path),"Chat/board write allowed");
            foreach(string path in new[]{"/runtime/stop","/file/write","/provider-connections/claude/logout","https://example.invalid","/../jobs","/jobs#hidden"})Check(!DesktopReadPolicy.AllowsWrite(path),"Unapproved write denied");
            Console.WriteLine("PASS: shared WebView UI, tray lifecycle, scoped read/write bridge policy, nested child cleanup and saved reconnect.");return 0;
        }catch(Exception error){Console.Error.WriteLine(error);return 1;}finally{if(owned!=null)owned.Dispose();}
    }
}
