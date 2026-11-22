package app.pocketcode.mobile;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.service.notification.StatusBarNotification;
import java.net.URI;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Per-device snapshot supplied by the chat UI. Persist only hashed host and chat identities. */
final class ChatMutes {
    private static final String HOST="pocket.mute.host", ALIASES="pocket.mute.aliases";

    static String hostKey(String url) {
        URI uri=URI.create(url).normalize();
        String scheme=uri.getScheme(),host=uri.getHost();
        if(!("https".equalsIgnoreCase(scheme)||"http".equalsIgnoreCase(scheme))||host==null||uri.getUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null)
            throw new IllegalArgumentException("Invalid host URL");
        int port=uri.getPort();
        boolean defaultPort=port==-1||port==80&&scheme.equalsIgnoreCase("http")||port==443&&scheme.equalsIgnoreCase("https");
        String normalized=scheme.toLowerCase(Locale.ROOT)+"://"+host.toLowerCase(Locale.ROOT)+(defaultPort?"":":"+port)+uri.getRawPath().replaceAll("/+$","");
        return NotificationIdentity.hash(normalized);
    }
    static Set<String> aliases(String provider,String session,String job) {
        Set<String> result=new HashSet<>();
        if(provider==null||provider.isEmpty())return result;
        if(session!=null&&session.startsWith("pending-")){
            if(job==null||job.isEmpty())job=session.substring(8);
        }else if(session!=null&&!session.isEmpty())result.add(NotificationIdentity.hash(provider+"|session:"+session));
        if(job!=null&&!job.isEmpty())result.add(NotificationIdentity.hash(provider+"|job:"+job));
        return result;
    }
    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("chat-mutes-v1",Context.MODE_PRIVATE);
    }
    static void replace(Context context,String url,JSONArray values) throws JSONException {
        String host=hostKey(url);
        Set<String> muted=new HashSet<>();
        for(int i=0;i<values.length();i++){
            JSONObject chat=values.getJSONObject(i);
            Set<String> ids=aliases(chat.getString("provider"),chat.optString("sessionId"),chat.optString("jobId"));
            if(ids.isEmpty())throw new JSONException("Missing chat identity");
            muted.addAll(ids);
        }
        SharedPreferences.Editor edit=preferences(context).edit();
        if(muted.isEmpty())edit.remove(host);else edit.putStringSet(host,muted);
        edit.apply();
        // Dismiss completed progress cards too, even after their watching service has stopped.
        NotificationManager manager=context.getSystemService(NotificationManager.class);
        try{
            for(StatusBarNotification posted:manager.getActiveNotifications()){
                Notification notice=posted.getNotification();
                if(!host.equals(notice.extras.getString(HOST)))continue;
                String[] ids=notice.extras.getStringArray(ALIASES);
                if(ids!=null)for(String id:ids)if(muted.contains(id)){manager.cancel(posted.getTag(),posted.getId());break;}
            }
        }catch(SecurityException ignored){/* Delivery still consults the saved snapshot. */}
    }
    static boolean contains(Context context,String url,String provider,String session,String job){
        Set<String> muted=preferences(context).getStringSet(hostKey(url),Collections.emptySet());
        return !muted.isEmpty()&&!Collections.disjoint(muted,aliases(provider,session,job));
    }
    static boolean contains(Context context,Intent chat){
        return chat!=null&&contains(context,chat.getStringExtra("url"),chat.getStringExtra("provider"),chat.getStringExtra("sessionId"),chat.getStringExtra("jobId"));
    }
    static Notification identify(Notification notice,String url,String provider,String session,String job){
        notice.extras.putString(HOST,hostKey(url));
        notice.extras.putStringArray(ALIASES,aliases(provider,session,job).toArray(new String[0]));
        return notice;
    }
}
