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
    private final Set<String> seen=Collections.newSetFromMap(new LinkedHashMap<String,Boolean>(){@Override protected boolean removeEldestEntry(Map.Entry<String,Boolean> eldest){return size()>400;}});
    private ScheduledFuture<?> scheduled;
    private volatile Intent config;
    private volatile int generation;
    private volatile long serverNow;
    private boolean baseline;
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public void onCreate(){
        super.onCreate();
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
        config=new Intent(intent);int epoch=++generation;baseline=true;serverNow=0;seen.clear();
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
            String since=serverNow>0?"?since="+Math.max(0,serverNow-120000):"";
            connection=(HttpURLConnection)new URL(value(config,"url")+"/api/activity/events"+since).openConnection();
            connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(8000);connection.setReadTimeout(8000);
            connection.setRequestProperty("Authorization","Bearer "+value(config,"token"));
            int code=connection.getResponseCode();
            if(code==401||code==403){main.post(()->{if(epoch==generation)stopSelf();});return;}
            if(code!=200)return;
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream input=connection.getInputStream()){byte[] buffer=new byte[8192];int n;while((n=input.read(buffer))!=-1){if(bytes.size()+n>1048576)throw new IOException();bytes.write(buffer,0,n);}}
            JSONObject body=new JSONObject(bytes.toString("UTF-8"));JSONArray events=body.optJSONArray("events");
            boolean first=baseline;baseline=false;serverNow=body.optLong("now",serverNow);
            if(events==null)return;
            for(int i=0;i<events.length();i++){
                JSONObject event=events.getJSONObject(i);String id=event.optString("id");
                if(id.isEmpty()||!seen.add(id)||first)continue;
                // The chat watched from its own screen already reports its result.
                if(event.optString("sessionId").equals(ChatWatchService.watchedSession))continue;
                main.post(()->{if(epoch==generation)alert(config,event);});
            }
        }catch(Exception ignored){/* The next poll retries; tracking never surfaces transient network errors. */}
        finally{if(connection!=null)connection.disconnect();}
    }
    private void alert(Intent config,JSONObject event){
        NotificationManager manager=getSystemService(NotificationManager.class);
        if(Build.VERSION.SDK_INT>=24&&!manager.areNotificationsEnabled())return;
        String provider=event.optString("provider"),sessionId=event.optString("sessionId"),title=event.optString("title","Pocket Code");
        Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("chatNotification",true)
            .putExtra("provider",provider).putExtra("sessionId",sessionId).putExtra("jobId","").putExtra("cwd",event.optString("cwd")).putExtra("title",title);
        PendingIntent pending=PendingIntent.getActivity(this,sessionId.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        String status="stopped".equals(event.optString("status"))?text(config,"Stopped","Остановлено"):text(config,"Completed — open to view the result","Завершено — откройте результат");
        Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,ALERT_CHANNEL):new Notification.Builder(this).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        Notification notification=builder.setSmallIcon(R.drawable.ic_chat_notification).setContentTitle(title.substring(0,Math.min(title.length(),120))).setContentText(status)
            .setSubText("copilot".equals(provider)?"Copilot":"codex".equals(provider)?"Codex":"Claude").setContentIntent(pending).setAutoCancel(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE).setCategory(Notification.CATEGORY_MESSAGE).build();
        // One notification per chat: a later result replaces the earlier one instead of stacking.
        try{manager.notify("run:"+sessionId,ChatWatchService.ALERT_ID,notification);}catch(SecurityException ignored){}
    }
    private Notification tracking(){
        Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending=PendingIntent.getActivity(this,NOTIFICATION_ID,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL):new Notification.Builder(this).setPriority(Notification.PRIORITY_MIN);
        return builder.setSmallIcon(R.drawable.ic_chat_notification).setContentTitle("Pocket Code").setContentText(text(config,"Watching PC chats for results","Следим за чатами на ПК"))
            .setContentIntent(pending).setOngoing(true).setShowWhen(false).setVisibility(Notification.VISIBILITY_SECRET).setCategory(Notification.CATEGORY_SERVICE).build();
    }
    @Override public void onTimeout(int startId,int fgsType){stopSelf();}
    @Override public void onDestroy(){generation++;if(scheduled!=null)scheduled.cancel(true);worker.shutdownNow();main.removeCallbacksAndMessages(null);config=null;super.onDestroy();}
}
