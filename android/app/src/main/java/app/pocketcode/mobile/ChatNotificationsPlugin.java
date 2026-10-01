package app.pocketcode.mobile;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name="ChatNotifications",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class ChatNotificationsPlugin extends Plugin {
    private boolean asked;
    private Intent latest;
    @PluginMethod public void watch(PluginCall call) {
        try{latest=configuration(call);}catch(Exception error){call.reject("Invalid chat notification configuration");return;}
        if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){
            if(!asked){asked=true;requestPermissionForAlias("notifications",call,"permissionResult");}
            else call.resolve();
            return;
        }
        start(call);
    }
    @PermissionCallback private void permissionResult(PluginCall call){
        if(latest!=null&&getPermissionState("notifications")==PermissionState.GRANTED)start(call);
        else call.resolve();
    }
    private Intent configuration(PluginCall call)throws Exception{
            String url=call.getString("url","");
            java.net.URI uri=new java.net.URI(url);
            if(!("https".equals(uri.getScheme())||"http".equals(uri.getScheme()))||uri.getHost()==null||uri.getUserInfo()!=null)throw new Exception();
            Intent intent=new Intent(getContext(),ChatWatchService.class);
            for(String key:new String[]{"url","token","provider","sessionId","jobId","cwd","title","language"})intent.putExtra(key,call.getString(key,""));
            return intent;
    }
    private void start(PluginCall call){
        try{
            if(latest!=null){
                if(Build.VERSION.SDK_INT>=26)getContext().startForegroundService(latest);
                else getContext().startService(latest);
            }
            call.resolve();
        }catch(Exception error){call.reject("Chat notification could not start");}
    }
    @PluginMethod public void clear(PluginCall call){
        latest=null;
        getActivity().runOnUiThread(()->{
            ChatWatchService.cancelActive();
            getContext().stopService(new Intent(getContext(),ChatWatchService.class));
            getContext().getSystemService(android.app.NotificationManager.class).cancel(ChatWatchService.NOTIFICATION_ID);
            call.resolve();
        });
    }
    @PluginMethod public void pending(PluginCall call){
        Intent intent=getActivity().getIntent();JSObject result=new JSObject();
        if(intent!=null&&intent.getBooleanExtra("chatNotification",false)){
            JSObject chat=new JSObject();for(String key:new String[]{"provider","sessionId","jobId","cwd","title"})chat.put(key,intent.getStringExtra(key));
            result.put("chat",chat);intent.removeExtra("chatNotification");
        }
        call.resolve(result);
    }
}
