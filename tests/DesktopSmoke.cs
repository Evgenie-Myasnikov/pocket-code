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
    static void Check(bool value,string message){if(!value)throw new Exception(message);}
    static object Field(object target,string name){return target.GetType().GetField(name,BindingFlags.NonPublic|BindingFlags.Instance).GetValue(target);}
    static void Call(object target,string name){var task=(Task)target.GetType().GetMethod(name,BindingFlags.NonPublic|BindingFlags.Instance).Invoke(target,null);while(!task.IsCompleted){Application.DoEvents();Thread.Sleep(10);}task.GetAwaiter().GetResult();}
    [STAThread] public static int Main(string[] args){
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        PocketCodeOwnedHost owned=null;
        try{
            using(var form=new PocketDesktop(new[]{"--preview"},true)){
                form.Show();Application.DoEvents();Check(form.Visible,"Window opens");
                form.Close();Application.DoEvents();Check(!form.Visible&&!form.IsDisposed,"Close hides without exiting");
                form.RestoreWindow();Application.DoEvents();Check(form.Visible,"Tray open restores window");
                form.WindowState=FormWindowState.Minimized;Application.DoEvents();Check(!form.Visible,"Minimize hides window");
                form.RestoreWindow();Application.DoEvents();Check(form.WindowState==FormWindowState.Normal,"Restored window is normal");
                if(args.Length>0)using(var capture=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(capture,new Rectangle(Point.Empty,form.Size));capture.Save(args[0]);}
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
                using(var form=new PocketDesktop(new[]{"--source",temp},false)){
                    using(var bitmap=new Bitmap(2,2))using(var image=new MemoryStream()){
                        bitmap.Save(image,System.Drawing.Imaging.ImageFormat.Png);
                        File.WriteAllText(Path.Combine(temp,"pairing.html"),"<img src=\"data:image/png;base64,"+Convert.ToBase64String(image.ToArray())+"\" alt=\"Synthetic\"><code>https://example.invalid</code><a href=\"http://127.0.0.1:4318/setup/jira#synthetic\">Jira</a>");
                    }
                    typeof(PocketDesktop).GetMethod("LoadPairing",BindingFlags.NonPublic|BindingFlags.Instance).Invoke(form,null);
                    Check(((PictureBox)Field(form,"qr")).Image!=null,"Embedded pairing image loads");
                    Check(((Button)Field(form,"jira")).Enabled,"Local Jira setup is available");
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
            Console.WriteLine("PASS: tray lifecycle, hidden child cleanup, saved disconnect and launch reconnection.");return 0;
        }catch(Exception error){Console.Error.WriteLine(error);return 1;}finally{if(owned!=null)owned.Dispose();}
    }
}
