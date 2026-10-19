package app.pocketcode.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

/** Separate channels per event class, so "finished" can be muted while questions and errors still ring. */
final class AlertChannels {
    static final String NEEDS_YOU="chat-attention";
    static final String ERRORS="chat-errors";
    static final String DONE="chat-done";
    private AlertChannels(){}
    static void create(NotificationManager manager){
        if(Build.VERSION.SDK_INT<26)return;
        NotificationChannel needs=new NotificationChannel(NEEDS_YOU,"Questions and approvals",NotificationManager.IMPORTANCE_HIGH);
        needs.setDescription("An agent waits for your answer or decision");manager.createNotificationChannel(needs);
        NotificationChannel errors=new NotificationChannel(ERRORS,"Errors",NotificationManager.IMPORTANCE_HIGH);
        errors.setDescription("A chat or task stopped with an error");manager.createNotificationChannel(errors);
        NotificationChannel done=new NotificationChannel(DONE,"Completed",NotificationManager.IMPORTANCE_DEFAULT);
        done.setDescription("A chat or task finished");manager.createNotificationChannel(done);
    }
    static String forState(String state){return "needs_input".equals(state)?NEEDS_YOU:"error".equals(state)?ERRORS:DONE;}
    /** False when the person turned this class of alerts off in Android settings. */
    static boolean enabled(NotificationManager manager,String channel){
        if(Build.VERSION.SDK_INT>=24&&!manager.areNotificationsEnabled())return false;
        if(Build.VERSION.SDK_INT<26)return true;
        NotificationChannel value=manager.getNotificationChannel(channel);
        return value==null||value.getImportance()!=NotificationManager.IMPORTANCE_NONE;
    }
}
