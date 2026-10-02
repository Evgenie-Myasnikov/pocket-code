using System;
using System.IO;
using System.Net.Http;
using System.Drawing;
using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Collections.Generic;

public sealed class DesktopPreferences {
    public bool Connect=true, Internet=true, AutoReconnect=true;
    public string Source="";
}
public static class DesktopReadPolicy {
    public static bool Allows(string endpoint){
        if(String.IsNullOrEmpty(endpoint)||endpoint.Length>16384||endpoint.IndexOfAny(new[]{'\\','#','\r','\n'})>=0)return false;
        string path=endpoint.Split('?')[0];
        return Regex.IsMatch(path,@"^/(health|providers|projects|sessions|jobs|review|review/availability|project-artifact)$")||
            Regex.IsMatch(path,@"^/sessions/[A-Za-z0-9_%.-]+/(messages|subagents)$")||
            Regex.IsMatch(path,@"^/sessions/[A-Za-z0-9_%.-]+/subagents/[A-Za-z0-9_%.-]+/messages$")||
            Regex.IsMatch(path,@"^/jobs/[A-Za-z0-9_-]+$");
    }
}
public sealed class PocketDesktop:Form {
    const string RunKey=@"Software\Microsoft\Windows\CurrentVersion\Run",Origin="https://pocket-code.internal";
    readonly string storage,settingsFile;
    readonly JavaScriptSerializer json=new JavaScriptSerializer{MaxJsonLength=32*1024*1024};
    readonly HttpClient http=new HttpClient(new HttpClientHandler{AllowAutoRedirect=false,UseProxy=false}){Timeout=TimeSpan.FromSeconds(3)};
    readonly HttpClient reader=new HttpClient(new HttpClientHandler{AllowAutoRedirect=false,UseProxy=false}){Timeout=TimeSpan.FromSeconds(95)};
    readonly SemaphoreSlim reads=new SemaphoreSlim(8);
    readonly NotifyIcon tray=new NotifyIcon();
    readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer{Interval=4000};
    readonly WebView2 web=new WebView2{Dock=DockStyle.Fill,DefaultBackgroundColor=Color.FromArgb(17,21,18)};
    readonly TaskCompletionSource<bool> initialized=new TaskCompletionSource<bool>();
    DesktopPreferences preferences;
    PocketCodeOwnedHost owner;
    bool polling,online,changing,exiting,webReady,autoStartPending;
    int failures;
    DateTime nextAttempt=DateTime.MinValue;
    string status="Ready to connect",jiraUrl;
    object[] addresses=new object[0];
    readonly bool preview;
    public Task Ready{get{return initialized.Task;}}

    [STAThread] public static void Main(string[] args){
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        bool preview=Array.IndexOf(args,"--preview")>=0;
        string identity=System.Security.Principal.WindowsIdentity.GetCurrent().User.Value;
        using(var wake=new EventWaitHandle(false,EventResetMode.AutoReset,"Local\\PocketCodeDesktopWake-"+identity)){
            bool created;using(var mutex=new Mutex(true,"Local\\PocketCodeDesktop-"+identity,out created)){
                if(!created&&!preview){wake.Set();return;}
                try{using(var form=new PocketDesktop(args,preview)){
                    var registration=ThreadPool.RegisterWaitForSingleObject(wake,(_,timedOut)=>{try{if(form.IsHandleCreated&&!form.IsDisposed)form.BeginInvoke((Action)(()=>form.RestoreWindow()));}catch(InvalidOperationException){}},null,-1,false);
                    try{Application.Run(form);}finally{registration.Unregister(null);}
                }}catch(Exception error){MessageBox.Show(error.Message,"Pocket Code",MessageBoxButtons.OK,MessageBoxIcon.Error);}
            }
        }
    }
    public PocketDesktop(string[] args,bool previewMode){
        preview=previewMode;storage=Environment.GetEnvironmentVariable("POCKET_DATA_DIR")??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),".pocket-code");
        settingsFile=Path.Combine(storage,"desktop.json");preferences=new DesktopPreferences();
        if(!preview&&File.Exists(settingsFile))try{preferences=json.Deserialize<DesktopPreferences>(File.ReadAllText(settingsFile))??preferences;}catch{}
        int source=Array.IndexOf(args,"--source");if(source>=0&&source+1<args.Length)preferences.Source=Path.GetFullPath(args[source+1]);
        if(String.IsNullOrEmpty(preferences.Source))preferences.Source=AppDomain.CurrentDomain.BaseDirectory;
        Text="Pocket Code";ClientSize=new Size(1280,850);MinimumSize=new Size(900,640);StartPosition=FormStartPosition.CenterScreen;
        BackColor=Color.FromArgb(17,21,18);AutoScaleMode=AutoScaleMode.Dpi;Icon=SystemIcons.Application;Controls.Add(web);
        var menu=new ContextMenuStrip();menu.Items.Add("Открыть",null,(_,e)=>RestoreWindow());menu.Items.Add("Подключить / отключить",null,async(_,e)=>await Toggle());menu.Items.Add(new ToolStripSeparator());menu.Items.Add("Выход",null,async(_,e)=>await ExitApp());
        tray.Text="Pocket Code";tray.Icon=Icon;tray.ContextMenuStrip=menu;tray.Visible=!preview;tray.DoubleClick+=(_,e)=>RestoreWindow();
        FormClosing+=(_,e)=>{if(!exiting&&e.CloseReason==CloseReason.UserClosing){e.Cancel=true;Hide();}else{timer.Stop();if(owner!=null){owner.Dispose();owner=null;}tray.Visible=false;}};
        Resize+=(_,e)=>{if(WindowState==FormWindowState.Minimized)Hide();};timer.Tick+=async(_,e)=>await Poll();autoStartPending=preferences.Connect&&preferences.AutoReconnect;
        Shown+=async(_,e)=>{try{if(Array.IndexOf(args,"--background")>=0)Hide();await InitializeWeb();if(!preview){Save();timer.Start();await Poll();}}catch(Exception error){status=error.Message;initialized.TrySetException(error);MessageBox.Show(error.Message+"\nRun the desktop installer again. Microsoft Edge WebView2 Runtime must be installed.","Pocket Code",MessageBoxButtons.OK,MessageBoxIcon.Error);}};
    }
    async Task InitializeWeb(){
        string ui=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"ui");if(!File.Exists(Path.Combine(ui,"index.html")))throw new FileNotFoundException("Desktop interface is missing.");
        string profile=preview?Path.Combine(Path.GetTempPath(),"PocketCodeDesktopPreview"):Path.Combine(storage,"desktop-webview");
        var environment=await CoreWebView2Environment.CreateAsync(null,profile);await web.EnsureCoreWebView2Async(environment);
        var core=web.CoreWebView2;core.SetVirtualHostNameToFolderMapping("pocket-code.internal",ui,CoreWebView2HostResourceAccessKind.DenyCors);
        core.Settings.AreHostObjectsAllowed=false;core.Settings.AreDevToolsEnabled=false;core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.IsStatusBarEnabled=false;core.Settings.IsPasswordAutosaveEnabled=false;core.Settings.IsGeneralAutofillEnabled=false;
        core.NavigationStarting+=(_,e)=>{Uri uri;if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out uri)||uri.GetLeftPart(UriPartial.Authority)!=Origin||uri.AbsolutePath!="/index.html")e.Cancel=true;};
        core.NewWindowRequested+=(_,e)=>{e.Handled=true;Uri uri;if(e.IsUserInitiated&&Uri.TryCreate(e.Uri,UriKind.Absolute,out uri)&&(uri.Scheme=="https"||uri.Scheme=="http"))OpenUrl(e.Uri);};
        core.PermissionRequested+=(_,e)=>e.State=CoreWebView2PermissionState.Deny;
        core.DownloadStarting+=(_,e)=>{e.Cancel=true;if(e.DownloadOperation.MimeType!="application/pdf"||!e.DownloadOperation.Uri.StartsWith("data:application/pdf",StringComparison.OrdinalIgnoreCase))return;using(var dialog=new SaveFileDialog{Filter="PDF document|*.pdf",FileName="document.pdf",AddExtension=true,DefaultExt="pdf"}){if(dialog.ShowDialog(this)==DialogResult.OK){e.ResultFilePath=dialog.FileName;e.Handled=true;e.Cancel=false;}}};
        core.AddWebResourceRequestedFilter("*",CoreWebView2WebResourceContext.All);
        core.WebResourceRequested+=(_,e)=>{Uri uri;if(Uri.TryCreate(e.Request.Uri,UriKind.Absolute,out uri)&&(uri.GetLeftPart(UriPartial.Authority)==Origin||uri.Scheme=="data"||uri.Scheme=="blob"||e.ResourceContext==CoreWebView2WebResourceContext.Image&&uri.Scheme=="https"))return;e.Response=core.Environment.CreateWebResourceResponse(new MemoryStream(),403,"External request blocked","");};
        core.WebMessageReceived+=async(_,e)=>await Bridge(e.Source,e.WebMessageAsJson);
        core.NavigationCompleted+=(_,e)=>{if(e.IsSuccess){webReady=true;Push();initialized.TrySetResult(true);}else initialized.TrySetException(new InvalidOperationException("Desktop interface could not load."));};
        core.Navigate(Origin+"/index.html?desktop=1");
    }
    async Task Bridge(string source,string payload){
        Uri origin;if(!Uri.TryCreate(source,UriKind.Absolute,out origin)||origin.GetLeftPart(UriPartial.Authority)!=Origin||origin.AbsolutePath!="/index.html")return;
        object id=null;try{
            var message=json.Deserialize<Dictionary<string,object>>(payload);if(!message.TryGetValue("id",out id)||!message.ContainsKey("action"))return;
            string action=message["action"] as string;object result;
            if(action=="read"){
                string endpoint=message.ContainsKey("endpoint")?message["endpoint"] as string:null;
                if(preview||!DesktopReadPolicy.Allows(endpoint))throw new InvalidOperationException("Desktop chats are read-only. This request is not allowed.");
                await reads.WaitAsync();try{result=await Send(reader,endpoint,false);}finally{reads.Release();}
            }else{
                if(action=="toggle")await Toggle();
                else if(action=="jira"){if(!preview&&jiraUrl!=null)OpenUrl(jiraUrl);}
                else if(action=="settings"){
                    if(preview)throw new InvalidOperationException("Preview settings are not saved.");
                    if(message.ContainsKey("startup"))SetStartup((bool)message["startup"]);
                    if(message.ContainsKey("autoReconnect"))preferences.AutoReconnect=(bool)message["autoReconnect"];
                    if(message.ContainsKey("internet")){if(online||owner!=null)throw new InvalidOperationException("Disconnect before changing connection mode.");preferences.Internet=(bool)message["internet"];}
                    Save();
                }else if(action!="state")throw new InvalidOperationException("Unknown desktop action.");result=Snapshot();
            }Reply(new{id=id,value=result});
        }catch(Exception error){Reply(new{id=id,error=error.Message});}
    }
    void Reply(object message){if(exiting||IsDisposed)return;try{if(web.CoreWebView2!=null)web.CoreWebView2.PostWebMessageAsJson(json.Serialize(message));}catch(InvalidOperationException){}}
    void Push(){if(webReady&&!exiting)Reply(new{state=Snapshot()});}
    object Snapshot(){return new{online=online,busy=changing||owner!=null&&!online,status=status,startup=!preview&&StartupEnabled(),autoReconnect=preferences.AutoReconnect,internet=preferences.Internet,addresses=addresses,jira=jiraUrl!=null};}
    public void RestoreWindow(){Show();WindowState=FormWindowState.Normal;Activate();}
    void Save(){if(preview)return;Directory.CreateDirectory(storage);string temp=settingsFile+".tmp";File.WriteAllText(temp,json.Serialize(preferences),Encoding.UTF8);if(File.Exists(settingsFile))File.Replace(temp,settingsFile,null);else File.Move(temp,settingsFile);}
    bool StartupEnabled(){using(var key=Registry.CurrentUser.OpenSubKey(RunKey))return key!=null&&key.GetValue("PocketCode")!=null;}
    void SetStartup(bool enabled){using(var key=Registry.CurrentUser.CreateSubKey(RunKey)){if(enabled)key.SetValue("PocketCode","\""+Application.ExecutablePath+"\" --background --source \""+preferences.Source+"\"");else key.DeleteValue("PocketCode",false);}}
    async Task<object> Send(HttpClient client,string endpoint,bool post){
        string token=File.ReadAllText(Path.Combine(storage,"connection-key.txt")).Trim();
        using(var request=new HttpRequestMessage(post?HttpMethod.Post:HttpMethod.Get,"http://127.0.0.1:4318/api"+endpoint)){
            request.Headers.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",token);if(post)request.Content=new StringContent("{}",Encoding.UTF8,"application/json");
            using(var response=await client.SendAsync(request)){
                string body=await response.Content.ReadAsStringAsync();object parsed=null;try{parsed=json.DeserializeObject(body);}catch{}
                if(!response.IsSuccessStatusCode){var fields=parsed as Dictionary<string,object>;throw new InvalidOperationException(fields!=null&&fields.ContainsKey("error")?Convert.ToString(fields["error"]):"Host request failed: "+(int)response.StatusCode);}return parsed;
            }
        }
    }
    Task<object> Request(string endpoint,bool post=false){return Send(http,"/"+endpoint,post);}
    async Task<bool> Check(){try{var runtime=(Dictionary<string,object>)await Request("runtime");if(!runtime.ContainsKey("applicationId")||(string)runtime["applicationId"]!="app.pocketcode.host")return false;status="Pocket Code "+runtime["version"]+(owner==null?" · existing host":" · connected");return true;}catch{return false;}}
    async Task Poll(){
        if(preview||polling||changing||exiting)return;polling=true;
        try{online=await Check();if(exiting||changing)return;if(online){failures=0;autoStartPending=false;LoadPairing();tray.Text="Pocket Code · connected";return;}
            addresses=new object[0];jiraUrl=null;if(owner!=null&&owner.ActiveCount==0){owner.Dispose();owner=null;nextAttempt=DateTime.UtcNow.AddSeconds(Math.Min(60,5*Math.Pow(2,Math.Min(failures++,4))));}
            if(owner!=null){status="Starting the host / restoring connection…";return;}
            status=preferences.Connect&&preferences.AutoReconnect?"Host unavailable. Reconnecting…":"Disconnected";if(failures>0)status+=" See desktop-launch.log in the Pocket Code data folder.";tray.Text="Pocket Code · disconnected";
            if(preferences.Connect&&(autoStartPending||preferences.AutoReconnect)&&DateTime.UtcNow>=nextAttempt){autoStartPending=false;Launch();}
        }catch(Exception error){status=error.Message;nextAttempt=DateTime.UtcNow.AddSeconds(30);}finally{polling=false;Push();}
    }
    void Launch(){
        string script=Path.Combine(preferences.Source,"scripts","start.ps1");if(!File.Exists(script))throw new FileNotFoundException("Pocket Code source folder is missing. Run the installer from its new location.");
        Directory.CreateDirectory(storage);string command="& '"+script.Replace("'","''")+"' -Desktop"+(preferences.Internet?" -Internet":"")+" *> '"+Path.Combine(storage,"desktop-launch.log").Replace("'","''")+"'";
        owner=PocketCodeOwnedHost.Start(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe"),"-NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand "+Convert.ToBase64String(Encoding.Unicode.GetBytes(command)),preferences.Source,true);status="Preparing the host. First launch may take several minutes.";
    }
    async Task Toggle(){if(preview||changing||exiting)return;changing=true;Push();try{
        while(polling&&!exiting)await Task.Delay(50);if(exiting)return;
        if(online||owner!=null){if(online)await Request("runtime/stop",true);preferences.Connect=false;Save();if(online)await Task.Delay(500);if(owner!=null){owner.Dispose();owner=null;}online=false;addresses=new object[0];jiraUrl=null;status="Disconnected";}
        else{preferences.Connect=true;Save();nextAttempt=DateTime.MinValue;Launch();}
    }catch(Exception error){status=error.Message;}finally{changing=false;Push();}await Poll();}
    async Task ExitApp(){if(exiting||changing)return;changing=true;try{
        if(owner==null&&online)await Request("runtime/stop",true);exiting=true;timer.Stop();if(owner!=null){owner.Dispose();owner=null;}tray.Visible=false;Close();
    }catch(Exception error){status=error.Message;RestoreWindow();Push();}finally{changing=false;}}
    void LoadPairing(){
        string file=Path.Combine(storage,"pairing.html");if(!File.Exists(file))return;string html=File.ReadAllText(file);var items=new List<object>();
        foreach(Match match in Regex.Matches(html,"src=\"(data:image/png;base64,[^\"]+)\"[^>]*>\\s*<code>([^<]+)</code>"))items.Add(new{image=match.Groups[1].Value,url=System.Net.WebUtility.HtmlDecode(match.Groups[2].Value)});
        addresses=items.ToArray();var setup=Regex.Match(html,"href=\"(http://127\\.0\\.0\\.1:4318/setup/jira#[^\"]+)\"");jiraUrl=setup.Success?System.Net.WebUtility.HtmlDecode(setup.Groups[1].Value):null;
    }
    void OpenUrl(string url){Process.Start(new ProcessStartInfo(url){UseShellExecute=true});}
    protected override void Dispose(bool disposing){if(disposing){timer.Dispose();tray.Dispose();web.Dispose();http.Dispose();reader.Dispose();if(owner!=null)owner.Dispose();}base.Dispose(disposing);}
}
