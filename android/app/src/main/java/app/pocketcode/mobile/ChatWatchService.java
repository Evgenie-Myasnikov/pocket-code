package app.pocketcode.mobile;

import android.app.*;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.*;
import org.json.*;
import java.net.*;
import java.io.*;
import java.util.concurrent.*;

/** User-visible, bounded sync of the selected PC chat, independent of WebView timers. */
public class ChatWatchService extends Service {
    static final int NOTIFICATION_ID=4301;
    private static final String CHANNEL="chat-progress";
    private static final String ALERT_CHANNEL="chat-attention";
    static final int ALERT_ID=4302;
    private final ChatAlertState alerts=new ChatAlertState();
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> scheduled;
    private volatile HttpURLConnection request;
    private volatile int generation;
    private Intent selection;
    private static volatile ChatWatchService active;
    static volatile boolean attentionEnabled=true;
    private boolean keepNotification;
    private String lastState="";
    private long started;
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public void onCreate(){
        super.onCreate();
        active=this;
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel channel=new NotificationChannel(CHANNEL,"Chat activity",NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Progress of the last open Pocket Code chat");
            channel.setShowBadge(false);getSystemService(NotificationManager.class).createNotificationChannel(channel);
            AlertChannels.create(getSystemService(NotificationManager.class));
        }
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null){stopSelf();return START_NOT_STICKY;}
        boolean same=selection!=null&&key(selection).equals(key(intent));
        selection=new Intent(intent);
        if(same)return START_NOT_STICKY;
        int epoch=++generation;started=System.currentTimeMillis();lastState="";alerts.reset();keepNotification=false;
        if(scheduled!=null)scheduled.cancel(true);
        if(request!=null)request.disconnect();
        Notification initial=notification(text("Checking chat status","Проверяем состояние чата"),true);
        try{
            if(Build.VERSION.SDK_INT>=29)startForeground(NOTIFICATION_ID,initial,ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(NOTIFICATION_ID,initial);
        }catch(RuntimeException error){stopSelf();return START_NOT_STICKY;}
        Intent snapshot=new Intent(selection);failures=0;
        scheduled=worker.schedule(()->cycle(snapshot,epoch),0,TimeUnit.SECONDS);
        return START_NOT_STICKY;
    }
    // Every 5 s while the PC answers; after failures the interval grows (10, 20, 40, 60 s) instead of knocking on a host that is down.
    private volatile int failures;
    private void cycle(Intent config,int epoch){
        if(epoch!=generation)return;
        poll(config,epoch);
        if(epoch!=generation||worker.isShutdown())return;
        long delay=failures==0?5:Math.min(60,5L<<Math.min(failures,4));
        try{scheduled=worker.schedule(()->cycle(config,epoch),delay,TimeUnit.SECONDS);}catch(RejectedExecutionException ignored){}
    }
    private String key(Intent value){return value.getStringExtra("url")+"|"+value.getStringExtra("token")+"|"+value.getStringExtra("provider")+"|"+value.getStringExtra("sessionId")+"|"+value.getStringExtra("jobId")+"|"+value.getStringExtra("alerts");}
    private String value(Intent intent,String name){String value=intent.getStringExtra(name);return value==null?"":value;}
    private void poll(Intent config,int epoch){
        if(epoch!=generation)return;
        if(System.currentTimeMillis()-started>350*60*1000L){publish(epoch,"paused",true);return;}
        HttpURLConnection connection=null;
        try{
            connection=(HttpURLConnection)new URL(value(config,"url")+"/api/activity").openConnection();request=connection;
            connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(8000);connection.setReadTimeout(8000);
            connection.setRequestProperty("Authorization","Bearer "+value(config,"token"));
            int code=connection.getResponseCode();
            if(code==401||code==403||code==404){publish(epoch,code==404?"update":"auth",true);return;}
            if(code!=200)throw new IOException();
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream input=connection.getInputStream()){
                byte[] buffer=new byte[8192];int n;
                while((n=input.read(buffer))!=-1){if(bytes.size()+n>1048576)throw new IOException();bytes.write(buffer,0,n);}
            }
            JSONArray items=new JSONArray(bytes.toString("UTF-8"));JSONObject newest=null;
            for(int i=0;i<items.length();i++){
                JSONObject item=items.getJSONObject(i);
                boolean matches=!value(config,"sessionId").isEmpty()?value(config,"sessionId").equals(item.optString("sessionId")):value(config,"jobId").equals(item.optString("id"));
                if(matches&&value(config,"provider").equals(item.optString("provider"))&&(newest==null||item.optLong("startedAt")>newest.optLong("startedAt")))newest=item;
            }
            String status=newest==null?"idle":newest.optString("status","idle");
            boolean terminal=status.equals("done")||status.equals("error")||status.equals("stopped");
            if(newest!=null){
                String jobId=newest.optString("id"),sessionId=newest.optString("sessionId");
                String eventStatus=status,eventVersion=newest.optString("version");long jobStarted=newest.optLong("startedAt");
                main.post(()->{if(epoch==generation)alert(config,jobId,sessionId,eventStatus,eventVersion,jobStarted);});
                main.post(()->{if(epoch==generation){selection.putExtra("jobId",jobId);selection.putExtra("sessionId",sessionId);}});
                if(status.equals("running")){
                    String action=newest.optString("action");
                    if(action.matches("command|files|search|agent|responding|tool"))status=action;
                }
            }
            failures=0;
            if(status.equals("idle")&&System.currentTimeMillis()-started>15*60*1000){publish(epoch,"paused",true);return;}
            publish(epoch,status,terminal);
        }catch(Exception error){failures++;publish(epoch,"offline",false);}
        finally{if(connection!=null)connection.disconnect();if(request==connection)request=null;}
    }
    private void publish(int epoch,String state,boolean terminal){
        main.post(()->{
            if(epoch!=generation)return;
            if(!state.equals(lastState)){
                lastState=state;
                getSystemService(NotificationManager.class).notify(NOTIFICATION_ID,notification(statusText(state),!terminal));
            }
            if(terminal){keepNotification=true;stopForeground(STOP_FOREGROUND_DETACH);stopSelf();}
        });
    }
    private String text(String en,String ru){return selection!=null&&"ru".equals(selection.getStringExtra("language"))?ru:en;}
    private void alert(Intent config,String jobId,String sessionId,String state,String version,long jobStarted){
        if(!attentionEnabled)return;
        if(!alerts.observe(jobId,state,jobStarted,started))return;
        String key=NotificationIdentity.event(value(config,"url"),value(config,"provider"),jobId,version,state);
        android.content.SharedPreferences seen=getSharedPreferences("chat-alerts",MODE_PRIVATE);
        if(seen.contains(key))return;
        NotificationManager manager=getSystemService(NotificationManager.class);
        String channel=AlertChannels.forState(state);
        if(!AlertChannels.enabled(manager,channel))return;
        selection.putExtra("jobId",jobId);selection.putExtra("sessionId",sessionId);
        try{manager.notify("run:"+NotificationIdentity.target(value(config,"url"),value(config,"provider"),sessionId,jobId),ALERT_ID,notification(statusText(state),false,channel));}catch(SecurityException ignored){return;}
        rememberAlert(seen,key);
    }
    static void rememberAlert(android.content.SharedPreferences seen,String key){
        android.content.SharedPreferences.Editor edit=seen.edit();
        if(seen.getAll().size()>=400){String oldest=seen.getAll().entrySet().stream().min(java.util.Comparator.comparingLong(entry->((Number)entry.getValue()).longValue())).map(java.util.Map.Entry::getKey).orElse(null);if(oldest!=null)edit.remove(oldest);}
        edit.putLong(key,System.currentTimeMillis()).apply();
    }
    private String statusText(String state){
        switch(state){
            case "running":return text("Working on your PC","Работает на ПК");
            case "command":return text("Running a command","Выполняет команду");
            case "files":return text("Editing files","Изменяет файлы");
            case "search":return text("Searching","Выполняет поиск");
            case "agent":return text("Working with a subagent","Работает с субагентом");
            case "responding":return text("Preparing a response","Готовит ответ");
            case "tool":return text("Using a tool","Использует инструмент");
            case "needs_input":return text("Waiting for your answer","Ожидает вашего ответа");
            case "done":return text("Completed — open to view the result","Завершено — откройте результат");
            case "error":return text("Error — open the chat for details","Ошибка — подробности в чате");
            case "stopped":return text("Stopped","Остановлено");
            case "offline":return text("PC unavailable — reconnecting","ПК недоступен — переподключение");
            case "update":return text("Update the PC server to track activity","Обновите сервер ПК для отслеживания");
            case "auth":return text("Reconnect to your PC","Подключитесь к ПК заново");
            case "paused":return text("Tracking paused — reopen the chat","Отслеживание приостановлено — откройте чат");
            case "timeout":return text("Android paused background tracking — open Pocket Code to resume","Android приостановил фоновое отслеживание — откройте Pocket Code, чтобы возобновить");
            default:return text("Chat open — waiting for activity","Чат открыт — ожидаем активности");
        }
    }
    private Notification notification(String status,boolean ongoing){
        return notification(status,ongoing,null);
    }
    private Notification notification(String status,boolean ongoing,String alertChannel){
        boolean attention=alertChannel!=null;
        Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        open.putExtra("chatNotification",true);
        open.putExtra("connectionUrl",value(selection,"url"));
        open.setData(android.net.Uri.parse("pocket-code://chat/"+NotificationIdentity.target(value(selection,"url"),value(selection,"provider"),value(selection,"sessionId"),value(selection,"jobId"))));
        for(String key:new String[]{"provider","sessionId","jobId","cwd","title"})open.putExtra(key,value(selection,key));
        PendingIntent pending=PendingIntent.getActivity(this,attention?ALERT_ID:NOTIFICATION_ID,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        String title=value(selection,"title");if(title.isEmpty())title="Pocket Code";
        Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,attention?alertChannel:CHANNEL):new Notification.Builder(this);
        if(attention)builder.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
        return builder.setSmallIcon(R.drawable.ic_chat_notification)
            .setContentTitle(title.substring(0,Math.min(title.length(),120))).setContentText(status)
            .setSubText("copilot".equals(value(selection,"provider"))?"Copilot":"codex".equals(value(selection,"provider"))?"Codex":"Claude")
            .setContentIntent(pending).setOnlyAlertOnce(!attention).setOngoing(ongoing).setAutoCancel(!ongoing)
            .setVisibility(Notification.VISIBILITY_PRIVATE).setCategory(attention?Notification.CATEGORY_MESSAGE:Notification.CATEGORY_PROGRESS).build();
    }
    @Override public void onTimeout(int startId,int fgsType){
        // Android 15+ limits data sync to six hours a day: say so instead of silently stopping alerts.
        getSystemService(NotificationManager.class).notify(NOTIFICATION_ID,notification(statusText("timeout"),false));
        keepNotification=true;stopForeground(STOP_FOREGROUND_DETACH);stopSelf();
    }
    static void cancelActive(){if(active!=null){active.generation++;active.keepNotification=false;}}
    @Override public void onDestroy(){generation++;if(scheduled!=null)scheduled.cancel(true);if(request!=null)request.disconnect();worker.shutdownNow();main.removeCallbacksAndMessages(null);if(!keepNotification)getSystemService(NotificationManager.class).cancel(NOTIFICATION_ID);selection=null;if(active==this)active=null;super.onDestroy();}
}
