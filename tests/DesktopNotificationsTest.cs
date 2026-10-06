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
        Console.WriteLine("Desktop notifications: 11 checks passed without displaying OS notifications");return 0;
    }
}
