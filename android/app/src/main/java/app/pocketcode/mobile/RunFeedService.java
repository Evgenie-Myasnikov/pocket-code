package app.pocketcode.mobile;

import android.app.*;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.*;
import org.json.*;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

/** While paired, follows completions of every PC chat, including chats never opened on the phone. */
public class RunFeedService extends Service {
    static final int NOTIFICATION_ID=4303;
    private static final String CHANNEL="chat-tracking";
    private static final String ALERT_CHANNEL="chat-attention";
    private final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor();
    private final Handler main=new Handler(Looper.getMainLooper());
    private final Set<String> seen=Collections.newSetFromMap(new LinkedHashMap<String,Boolean>(){@Override protected boolean removeEldestEntry(Map.Entry<String,Boolean> eldest){return size()>1200;}});
    private ScheduledFuture<?> scheduled;
    private volatile Intent config;
    private volatile int generation;
    private volatile long serverNow;
    private boolean baseline;
    private volatile HttpURLConnection activeRequest;
    private android.content.SharedPreferences checkpoint;
    private static volatile RunFeedService active;
    static void cancelActive(){if(active!=null)active.generation++;}
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public void onCreate(){
        super.onCreate();
        active=this;
        if(Build.VERSION.SDK_INT>=26){
            NotificationManager manager=getSystemService(NotificationManager.class);
            NotificationChannel channel=new NotificationChannel(CHANNEL,"PC chat tracking",NotificationManager.IMPORTANCE_MIN);
            channel.setDescription("Keeps watching PC chats so finished ones can notify you");channel.setShowBadge(false);manager.createNotificationChannel(channel);
            NotificationChannel attention=new NotificationChannel(ALERT_CHANNEL,"Chat results and questions",NotificationManager.IMPORTANCE_HIGH);
            attention.setDescription("Completion, errors and requests for your answer");manager.createNotificationChannel(attention);
        }
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null){stopSelf();return START_NOT_STICKY;}
        Intent previous=config;
        if(previous!=null&&value(previous,"url").equals(value(intent,"url"))&&value(previous,"token").equals(value(intent,"token"))&&value(previous,"language").equals(value(intent,"language")))return START_NOT_STICKY;
        config=new Intent(intent);int epoch=++generation;
        checkpoint=getSharedPreferences("run-feed-"+NotificationIdentity.hash(value(intent,"url")+"|"+value(intent,"token")),MODE_PRIVATE);
        serverNow=checkpoint.getLong("cursor",0);baseline=serverNow==0;seen.clear();
        seen.addAll(checkpoint.getStringSet("seen",Collections.emptySet()));
        Notification ongoing=tracking();
        try{
            // A permanent watch needs specialUse: Android 15 limits dataSync services to six hours a day.
            if(Build.VERSION.SDK_INT>=34)startForeground(NOTIFICATION_ID,ongoing,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            else if(Build.VERSION.SDK_INT>=29)startForeground(NOTIFICATION_ID,ongoing,ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(NOTIFICATION_ID,ongoing);
        }catch(RuntimeException error){stopSelf();return START_NOT_STICKY;}
        if(scheduled!=null)scheduled.cancel(true);
        Intent snapshot=new Intent(config);
        scheduled=worker.scheduleWithFixedDelay(()->poll(snapshot,epoch),0,20,TimeUnit.SECONDS);
        return START_NOT_STICKY;
    }
    private String value(Intent intent,String name){String value=intent.getStringExtra(name);return value==null?"":value;}
    private String text(Intent config,String en,String ru){return "ru".equals(value(config,"language"))?ru:en;}
    private void poll(Intent config,int epoch){
        if(epoch!=generation)return;
        HttpURLConnection connection=null;
        try{
            // Overlap the window and dedupe by id, so an event recorded while a request was in flight is never lost.
            String since="?since="+Math.max(0,serverNow-120000);
            connection=(HttpURLConnection)new URL(value(config,"url")+"/api/activity/events"+since).openConnection();
            activeRequest=connection;
            connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(8000);connection.setReadTimeout(8000);
            connection.setRequestProperty("Authorization","Bearer "+value(config,"token"));
            int code=connection.getResponseCode();
            if(code==401||code==403){main.post(()->{if(epoch==generation)stopSelf();});return;}
            if(code!=200)return;
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream input=connection.getInputStream()){byte[] buffer=new byte[8192];int n;while((n=input.read(buffer))!=-1){if(bytes.size()+n>1048576)throw new IOException();bytes.write(buffer,0,n);}}
            JSONObject body=new JSONObject(bytes.toString("UTF-8"));
            main.post(()->accept(config,epoch,body));
        }catch(Exception ignored){/* The next poll retries; tracking never surfaces transient network errors. */}
        finally{if(connection!=null)connection.disconnect();if(activeRequest==connection)activeRequest=null;}
    }
    private void accept(Intent config,int epoch,JSONObject body){
        if(epoch!=generation)return;
        JSONArray events=body.optJSONArray("events");if(events==null)return;
        boolean first=baseline;baseline=false;serverNow=body.optLong("now",serverNow);
        for(int i=0;i<events.length();i++){
            JSONObject event=events.optJSONObject(i);if(event==null)continue;
            String id=event.optString("id");if(id.isEmpty()||!seen.add(id)||first)continue;
            // Shared fingerprints keep the active-chat service and this feed from notifying twice.
            alert(config,event);
        }
        checkpoint.edit().putLong("cursor",serverNow).putStringSet("seen",new HashSet<>(seen)).apply();
    }
    private void alert(Intent config,JSONObject event){
        NotificationManager manager=getSystemService(NotificationManager.class);
        if(Build.VERSION.SDK_INT>=24&&!manager.areNotificationsEnabled())return;
        if(Build.VERSION.SDK_INT>=26&&manager.getNotificationChannel(ALERT_CHANNEL).getImportance()==NotificationManager.IMPORTANCE_NONE)return;
        String provider=event.optString("provider"),sessionId=event.optString("sessionId"),title=event.optString("title","Pocket Code");
        String jobId=event.optString("jobId"),state=event.optString("status");
        String fingerprint=NotificationIdentity.event(value(config,"url"),provider,jobId.isEmpty()?event.optString("id"):jobId,event.optString("version"),state);
        android.content.SharedPreferences alerts=getSharedPreferences("chat-alerts",MODE_PRIVATE);
        if(alerts.contains(fingerprint))return;
        String target=NotificationIdentity.target(value(config,"url"),provider,sessionId,jobId);
        Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("chatNotification",true)
            .setData(android.net.Uri.parse("pocket-code://chat/"+target)).putExtra("connectionUrl",value(config,"url"))
            .putExtra("provider",provider).putExtra("sessionId",sessionId).putExtra("jobId",jobId).putExtra("cwd",event.optString("cwd")).putExtra("title",title);
        PendingIntent pending=PendingIntent.getActivity(this,sessionId.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        String status="needs_input".equals(state)?text(config,"Waiting for your answer","Ожидает вашего ответа"):
            "error".equals(state)?text(config,"Error — open the chat for details","Ошибка — подробности в чате"):
            "stopped".equals(state)?text(config,"Stopped","Остановлено"):text(config,"Completed — open to view the result","Завершено — откройте результат");
        Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,ALERT_CHANNEL):new Notification.Builder(this).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        Notification notification=builder.setSmallIcon(R.drawable.ic_chat_notification).setContentTitle(title.substring(0,Math.min(title.length(),120))).setContentText(status)
            .setSubText("copilot".equals(provider)?"Copilot":"codex".equals(provider)?"Codex":"Claude").setContentIntent(pending).setAutoCancel(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE).setCategory(Notification.CATEGORY_MESSAGE).build();
        // One notification per chat: a later result replaces the earlier one instead of stacking.
        try{manager.notify("run:"+target,ChatWatchService.ALERT_ID,notification);ChatWatchService.rememberAlert(alerts,fingerprint);}catch(SecurityException ignored){}
    }
    private Notification tracking(){
        Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending=PendingIntent.getActivity(this,NOTIFICATION_ID,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL):new Notification.Builder(this).setPriority(Notification.PRIORITY_MIN);
        return builder.setSmallIcon(R.drawable.ic_chat_notification).setContentTitle("Pocket Code").setContentText(text(config,"Watching PC chats for results","Следим за чатами на ПК"))
            .setContentIntent(pending).setOngoing(true).setShowWhen(false).setVisibility(Notification.VISIBILITY_SECRET).setCategory(Notification.CATEGORY_SERVICE).build();
    }
    @Override public void onTimeout(int startId,int fgsType){stopSelf();}
    @Override public void onDestroy(){generation++;if(scheduled!=null)scheduled.cancel(true);if(activeRequest!=null)activeRequest.disconnect();worker.shutdownNow();main.removeCallbacksAndMessages(null);config=null;if(active==this)active=null;super.onDestroy();}
}
