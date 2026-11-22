using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;
public static class DesktopNotificationsTest {
    static void Check(bool condition,string message){if(!condition)throw new Exception(message);}
    static Dictionary<string,object> Event(string id,string provider,string status,string job){return new Dictionary<string,object>{{"id",id},{"provider",provider},{"status",status},{"jobId",job},{"sessionId","synthetic-session"},{"cwd","synthetic-project"},{"title","Synthetic task"}};}
    static Dictionary<string,object> Batch(long now,params object[] events){return new Dictionary<string,object>{{"now",now},{"events",events}};}
    public static int Main(){
        var preferences=new DesktopPreferences();
        var old=Event("old","claude","done","old-run");
        DesktopRunAlertBatch.Accept(preferences,Batch(100,old));Check(preferences.PendingRunAlerts.Length==0,"Initial history is quiet");
        var question=Event("question","codex","needs_input","exact-run");
        DesktopRunAlertBatch.Accept(preferences,Batch(200,old,question));Check(preferences.PendingRunAlerts.Length==1,"New question is queued");
        var json=new JavaScriptSerializer();preferences=json.Deserialize<DesktopPreferences>(json.Serialize(preferences));
        DesktopRunAlertBatch.Accept(preferences,Batch(300,question,Event("done","codex","done","exact-run"),Event("failure","copilot","error","other-run")));
        Check(preferences.PendingRunAlerts.Length==3,"Restart preserves queue and dedupes overlap");
        Check(Convert.ToString(((Dictionary<string,object>)preferences.PendingRunAlerts[0])["jobId"])=="exact-run","Click target preserves exact job");
        Check(preferences.NotificationCursor==300,"Cursor survives reconnect");
        Check(DesktopReadPolicy.Allows("/activity/events?since=100"),"Native notification feed is allowed");
        Check(DesktopReadPolicy.Allows("/task-runs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),"Task result can open");
        Check(DesktopReadPolicy.AllowsWrite("/task-runs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/check"),"Task checks allowed");
        Check(!DesktopReadPolicy.AllowsWrite("/task-runs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/delete"),"Unrequested native action denied");
        Check(!DesktopReadPolicy.Allows("/activity/events#other"),"Fragment injection denied");
        Check(DesktopReadPolicy.Allows("/miro/status")&&DesktopReadPolicy.AllowsWrite("/miro/items/update"),"Miro scoped routes allowed");
        Check(DesktopReadPolicy.Allows("/speech/status")&&DesktopReadPolicy.AllowsWrite("/speech/install")&&DesktopReadPolicy.AllowsWrite("/speech/synthesize"),"Speech endpoints allowed");
        Check(!DesktopReadPolicy.AllowsWrite("/speech/delete")&&!DesktopReadPolicy.Allows("/speech/synthesize"),"Speech access stays scoped");
        // WebView JSON arrives as a list of dictionaries, just like the bridge message.
        var target=json.Deserialize<Dictionary<string,object>>("{\"mutedChats\":[{\"provider\":\"codex\",\"sessionId\":\"synthetic-session\",\"jobId\":\"exact-run\"}]}");
        DesktopRunAlertBatch.SetMuted(preferences,target["mutedChats"],325);
        Check(preferences.PendingRunAlerts.Length==1,"Mute removes queued matches while keeping the other provider");
        Check(preferences.NotificationCursor==300&&preferences.NotificationSeen.Length==4,"Mute preserves cursor and acknowledgements");
        preferences=json.Deserialize<DesktopPreferences>(json.Serialize(preferences));
        var byJob=Event("by-job","codex","error","exact-run");byJob.Remove("sessionId");byJob["at"]=350;
        var bySession=Event("by-session","codex","done","later-run");bySession["at"]=351;
        var other=Event("other","claude","done","exact-run");other["at"]=352;
        DesktopRunAlertBatch.Accept(preferences,Batch(400,byJob,bySession,other));
        Check(preferences.PendingRunAlerts.Length==2,"Persisted aliases suppress job-only and session-only matches, scoped by provider");
        Check(preferences.NotificationSeen.Length==7&&preferences.NotificationCursor==400,"Muted events advance the cursor and are acknowledged");
        DesktopRunAlertBatch.SetMuted(preferences,new object[0],420);
        var delayed=Event("delayed","codex","error","exact-run");delayed["at"]=410;
        var next=Event("next","codex","done","exact-run");next["at"]=421;
        DesktopRunAlertBatch.Accept(preferences,Batch(500,delayed,byJob,bySession,next));
        Check(preferences.PendingRunAlerts.Length==3,"Unmute delivers new events, including after an overlapping offline catch-up");
        Check(!DesktopRunAlertBatch.Suppressed(preferences,next)&&DesktopRunAlertBatch.Suppressed(preferences,delayed),"Presentation uses the same mute boundary");
        DesktopRunAlertBatch.Accept(preferences,Batch(130000));
        Check(preferences.RunAlertMutes.Count==0,"Unmuted aliases expire when the journal overlap passes");
        Console.WriteLine("Desktop notifications: cursor, queue, bridge policy and per-chat mute checks passed");return 0;
    }
}
