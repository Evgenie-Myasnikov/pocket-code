using System;
using System.IO;
using System.Net;
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
using System.Collections.Generic;

public sealed class DesktopPreferences {
    public bool Connect = true;
    public bool Internet = true;
    public bool AutoReconnect = true;
    public string Source = "";
}

public sealed class PocketDesktop : Form {
    const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    readonly string storage, settingsFile;
    readonly JavaScriptSerializer json = new JavaScriptSerializer();
    readonly HttpClient http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false, UseProxy = false }) { Timeout = TimeSpan.FromSeconds(3) };
    readonly NotifyIcon tray = new NotifyIcon();
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer { Interval = 4000 };
    readonly Label status = new Label(), address = new Label();
    readonly PictureBox qr = new PictureBox();
    readonly ComboBox addresses = new ComboBox();
    readonly Button toggle = new Button(), jira = new Button();
    readonly CheckBox startup = new CheckBox(), reconnect = new CheckBox(), internet = new CheckBox();
    readonly List<string> qrImages = new List<string>();
    DesktopPreferences preferences;
    PocketCodeOwnedHost owner;
    bool polling, online, changing, exiting, ready, autoStartPending;
    int failures;
    DateTime launched = DateTime.MinValue, nextAttempt = DateTime.MinValue, pairingStamp;
    string jiraUrl;
    readonly bool preview;

    [STAThread] public static void Main(string[] args) {
        Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
        bool preview = Array.IndexOf(args,"--preview") >= 0;
        string identity = System.Security.Principal.WindowsIdentity.GetCurrent().User.Value;
        using (var wake = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\PocketCodeDesktopWake-"+identity)) {
            bool created;
            using (var mutex = new Mutex(true,"Local\\PocketCodeDesktop-"+identity,out created)) {
                if(!created&&!preview){wake.Set();return;}
                try {
                    var form=new PocketDesktop(args,preview);
                    var registration=ThreadPool.RegisterWaitForSingleObject(wake,(_,timedOut)=>{try{if(form.IsHandleCreated&&!form.IsDisposed)form.BeginInvoke((Action)(()=>form.RestoreWindow()));}catch(InvalidOperationException){}},null,-1,false);
                    try{Application.Run(form);}finally{registration.Unregister(null);}
                } catch(Exception error) { MessageBox.Show(error.Message,"Pocket Code",MessageBoxButtons.OK,MessageBoxIcon.Error); }
            }
        }
    }

    public PocketDesktop(string[] args,bool previewMode) {
        preview=previewMode;
        storage=Environment.GetEnvironmentVariable("POCKET_DATA_DIR")??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),".pocket-code");
        settingsFile=Path.Combine(storage,"desktop.json");
        preferences=new DesktopPreferences();
        if(!preview&&File.Exists(settingsFile))try{preferences=json.Deserialize<DesktopPreferences>(File.ReadAllText(settingsFile))??preferences;}catch{}
        int source=Array.IndexOf(args,"--source");if(source>=0&&source+1<args.Length)preferences.Source=Path.GetFullPath(args[source+1]);
        if(String.IsNullOrEmpty(preferences.Source))preferences.Source=AppDomain.CurrentDomain.BaseDirectory;
        Text="Pocket Code";ClientSize=new Size(620,760);MinimumSize=new Size(540,690);StartPosition=FormStartPosition.CenterScreen;
        BackColor=Color.FromArgb(18,23,21);ForeColor=Color.FromArgb(229,236,227);Font=new Font("Segoe UI",10);AutoScaleMode=AutoScaleMode.Dpi;
        Icon=SystemIcons.Application;
        var root=new TableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(28),ColumnCount=1,RowCount=8};
        root.RowStyles.Add(new RowStyle(SizeType.Absolute,44));root.RowStyles.Add(new RowStyle(SizeType.Absolute,58));root.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute,38));root.RowStyles.Add(new RowStyle(SizeType.Absolute,40));root.RowStyles.Add(new RowStyle(SizeType.Absolute,52));root.RowStyles.Add(new RowStyle(SizeType.Absolute,108));root.RowStyles.Add(new RowStyle(SizeType.Absolute,36));
        root.Controls.Add(new Label{Text="Pocket Code",Font=new Font("Segoe UI",22,FontStyle.Bold),Dock=DockStyle.Fill},0,0);
        status.Text="Готов к подключению";status.Dock=DockStyle.Fill;status.ForeColor=Color.FromArgb(188,212,166);root.Controls.Add(status,0,1);
        qr.Dock=DockStyle.Fill;qr.SizeMode=PictureBoxSizeMode.Zoom;qr.BackColor=Color.FromArgb(25,32,28);root.Controls.Add(qr,0,2);
        addresses.Dock=DockStyle.Fill;addresses.DropDownStyle=ComboBoxStyle.DropDownList;addresses.BackColor=Color.FromArgb(25,32,28);addresses.ForeColor=ForeColor;addresses.FlatStyle=FlatStyle.Flat;addresses.SelectedIndexChanged+=(_,e)=>ShowQr();root.Controls.Add(addresses,0,3);
        address.Dock=DockStyle.Fill;address.Text="Выберите подключение и отсканируйте QR на телефоне.";address.AutoEllipsis=true;root.Controls.Add(address,0,4);
        var buttons=new FlowLayoutPanel{Dock=DockStyle.Fill};StyleButton(toggle,"Подключить");toggle.Click+=async(_,e)=>await Toggle();buttons.Controls.Add(toggle);
        StyleButton(jira,"Настройки Jira");jira.Enabled=false;jira.Click+=(_,e)=>OpenUrl(jiraUrl);buttons.Controls.Add(jira);root.Controls.Add(buttons,0,5);
        var settings=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false};
        startup.Text="Запускать с Windows";reconnect.Text="Восстанавливать последнее подключение";internet.Text="Подключение через интернет";
        foreach(var check in new[]{startup,reconnect,internet}){check.AutoSize=true;settings.Controls.Add(check);}
        reconnect.Checked=preferences.AutoReconnect;internet.Checked=preferences.Internet;startup.Checked=!preview&&StartupEnabled();
        startup.CheckedChanged+=(_,e)=>{if(ready&&!preview)try{SetStartup(startup.Checked);}catch(Exception error){status.Text=error.Message;ready=false;startup.Checked=StartupEnabled();ready=true;}};
        reconnect.CheckedChanged+=(_,e)=>{preferences.AutoReconnect=reconnect.Checked;SaveFromUi();};
        internet.CheckedChanged+=(_,e)=>{preferences.Internet=internet.Checked;SaveFromUi();};root.Controls.Add(settings,0,6);
        root.Controls.Add(new Label{Text="Закрытие окна сворачивает в трей. Выход — через меню значка.",Dock=DockStyle.Fill,Font=new Font("Segoe UI",9)},0,7);Controls.Add(root);
        var menu=new ContextMenuStrip();menu.Items.Add("Открыть",null,(_,e)=>RestoreWindow());menu.Items.Add("Подключить / отключить",null,async(_,e)=>await Toggle());menu.Items.Add(new ToolStripSeparator());menu.Items.Add("Выход",null,async(_,e)=>await ExitApp());
        tray.Text="Pocket Code";tray.Icon=Icon;tray.ContextMenuStrip=menu;tray.Visible=!preview;tray.DoubleClick+=(_,e)=>RestoreWindow();
        FormClosing+=(_,e)=>{if(!exiting&&e.CloseReason==CloseReason.UserClosing){e.Cancel=true;Hide();}else{timer.Stop();if(owner!=null){owner.Dispose();owner=null;}tray.Visible=false;}};
        Resize+=(_,e)=>{if(WindowState==FormWindowState.Minimized)Hide();};
        timer.Tick+=async(_,e)=>await Poll();
        autoStartPending=preferences.Connect&&preferences.AutoReconnect;
        Shown+=async(_,e)=>{if(preview){status.Text="Предпросмотр · без подключения к ПК";toggle.Enabled=false;return;}if(!SaveFromUi())return;if(Array.IndexOf(args,"--background")>=0)Hide();timer.Start();await Poll();};
        ready=true;
    }

    void StyleButton(Button button,string text){button.Text=text;button.AutoSize=true;button.Height=38;button.Padding=new Padding(12,4,12,4);button.FlatStyle=FlatStyle.Flat;button.Margin=new Padding(0,0,12,0);button.BackColor=Color.FromArgb(38,50,41);button.ForeColor=ForeColor;}
    public void RestoreWindow(){Show();WindowState=FormWindowState.Normal;Activate();}
    void Save(){if(preview)return;Directory.CreateDirectory(storage);string temp=settingsFile+".tmp";File.WriteAllText(temp,json.Serialize(preferences),Encoding.UTF8);if(File.Exists(settingsFile))File.Replace(temp,settingsFile,null);else File.Move(temp,settingsFile);}
    bool SaveFromUi(){try{Save();return true;}catch(Exception error){status.Text="Не удалось сохранить настройки: "+error.Message;return false;}}
    bool StartupEnabled(){using(var key=Registry.CurrentUser.OpenSubKey(RunKey))return key!=null&&key.GetValue("PocketCode")!=null;}
    void SetStartup(bool enabled){using(var key=Registry.CurrentUser.CreateSubKey(RunKey)){if(enabled)key.SetValue("PocketCode","\""+Application.ExecutablePath+"\" --background --source \""+preferences.Source+"\"");else key.DeleteValue("PocketCode",false);}}
    string Token(){return File.ReadAllText(Path.Combine(storage,"connection-key.txt")).Trim();}
    async Task<Dictionary<string,object>> Request(string endpoint,bool post=false){
        using(var request=new HttpRequestMessage(post?HttpMethod.Post:HttpMethod.Get,"http://127.0.0.1:4318/api/"+endpoint)){
            request.Headers.Authorization=new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",Token());
            if(post)request.Content=new StringContent("{}",Encoding.UTF8,"application/json");
            using(var response=await http.SendAsync(request)){if(response.StatusCode==HttpStatusCode.Conflict)throw new InvalidOperationException("Сначала завершите активные задачи или обновление сервера.");response.EnsureSuccessStatusCode();return json.Deserialize<Dictionary<string,object>>(await response.Content.ReadAsStringAsync());}
        }
    }
    async Task<bool> Check(){try{var runtime=await Request("runtime");if(!runtime.ContainsKey("applicationId")||(string)runtime["applicationId"]!="app.pocketcode.host")return false;status.Text="ПК подключён · версия "+runtime["version"]+(owner==null?"\nСервер запущен другим лаунчером":"\nОтсканируйте QR в приложении на телефоне");return true;}catch{return false;}}
    async Task Poll(){
        if(preview||polling||changing||exiting)return;polling=true;
        try{
            online=await Check();if(exiting||changing)return;
            toggle.Text=online||owner!=null?"Отключить":"Подключить";internet.Enabled=!online&&owner==null;
            if(online){failures=0;autoStartPending=false;LoadPairing();tray.Text="Pocket Code · подключён";return;}
            ClearQr();
            if(owner!=null&&owner.ActiveCount==0){owner.Dispose();owner=null;nextAttempt=DateTime.UtcNow.AddSeconds(Math.Min(60,5*Math.Pow(2,Math.Min(failures++,4))));}
            if(owner!=null){status.Text="Запускаем сервер / восстанавливаем связь…";return;}
            status.Text=preferences.Connect&&preferences.AutoReconnect?"Сервер недоступен. Повторное подключение…":"Отключено. Нажмите «Подключить», чтобы запустить сервер.";
            if(failures>0)status.Text+="\nПричина запуска записана в desktop-launch.log в папке данных Pocket Code.";
            tray.Text="Pocket Code · нет подключения";
            if(preferences.Connect&&(autoStartPending||preferences.AutoReconnect)&&DateTime.UtcNow>=nextAttempt){autoStartPending=false;Launch();}
        }catch(Exception error){status.Text=error.Message;nextAttempt=DateTime.UtcNow.AddSeconds(30);}finally{polling=false;}
    }
    void Launch(){
        string script=Path.Combine(preferences.Source,"scripts","start.ps1");if(!File.Exists(script))throw new FileNotFoundException("Не найдены исходники Pocket Code. Запустите приложение из папки проекта.");
        Directory.CreateDirectory(storage);
        string command="& '"+script.Replace("'","''")+"' -Desktop"+(preferences.Internet?" -Internet":"")+" *> '"+Path.Combine(storage,"desktop-launch.log").Replace("'","''")+"'";
        string encoded=Convert.ToBase64String(Encoding.Unicode.GetBytes(command));
        owner=PocketCodeOwnedHost.Start(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe"),"-NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand "+encoded,preferences.Source,true);
        launched=DateTime.UtcNow;pairingStamp=DateTime.MinValue;status.Text="Запускаем сервер… Первая подготовка может занять несколько минут.";
    }
    async Task Toggle(){if(preview||changing||exiting)return;changing=true;try{
        while(polling&&!exiting)await Task.Delay(50);
        if(exiting)return;
        if(online||owner!=null){
            if(online)await Request("runtime/stop",true);
            preferences.Connect=false;Save();if(online)await Task.Delay(500);if(owner!=null){owner.Dispose();owner=null;}online=false;ClearQr();status.Text="Отключено";
        }else{preferences.Connect=true;Save();nextAttempt=DateTime.MinValue;Launch();}
    }catch(Exception error){status.Text=error.Message;}finally{changing=false;}await Poll();}
    async Task ExitApp(){if(exiting||changing)return;changing=true;try{
        if(owner==null&&online)await Request("runtime/stop",true);
        exiting=true;timer.Stop();if(owner!=null){owner.Dispose();owner=null;}tray.Visible=false;Close();
    }catch(Exception error){status.Text=error.Message;RestoreWindow();}finally{changing=false;}}
    void ClearQr(){var old=qr.Image;qr.Image=null;if(old!=null)old.Dispose();addresses.Items.Clear();qrImages.Clear();jiraUrl=null;jira.Enabled=false;pairingStamp=DateTime.MinValue;}
    void LoadPairing(){
        string file=Path.Combine(storage,"pairing.html");if(!File.Exists(file))return;
        var stamp=File.GetLastWriteTimeUtc(file);if(stamp==pairingStamp||owner!=null&&stamp<launched)return;
        string html=File.ReadAllText(file);ClearQr();
        foreach(Match match in Regex.Matches(html,"src=\"data:image/png;base64,([^\"]+)\"[^>]*>\\s*<code>([^<]+)</code>")){qrImages.Add(match.Groups[1].Value);addresses.Items.Add(WebUtility.HtmlDecode(match.Groups[2].Value));}
        var setup=Regex.Match(html,"href=\"(http://127\\.0\\.0\\.1:4318/setup/jira#[^\"]+)\"");if(setup.Success)jiraUrl=WebUtility.HtmlDecode(setup.Groups[1].Value);
        jira.Enabled=jiraUrl!=null;pairingStamp=stamp;if(addresses.Items.Count>0)addresses.SelectedIndex=0;
    }
    void ShowQr(){int index=addresses.SelectedIndex;if(index<0||index>=qrImages.Count)return;using(var stream=new MemoryStream(Convert.FromBase64String(qrImages[index])))using(var image=Image.FromStream(stream)){var old=qr.Image;qr.Image=new Bitmap(image);if(old!=null)old.Dispose();}address.Text=addresses.Items[index].ToString();}
    void OpenUrl(string url){if(url!=null)Process.Start(new ProcessStartInfo(url){UseShellExecute=true});}
    protected override void Dispose(bool disposing){if(disposing){timer.Dispose();tray.Dispose();http.Dispose();if(qr.Image!=null)qr.Image.Dispose();if(owner!=null)owner.Dispose();}base.Dispose(disposing);}
}
