package app.pocketcode.mobile;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Stable non-secret identity shared by foreground and all-chat notification delivery. */
final class NotificationIdentity {
    static String hash(String value) {
        try {
            byte[] digest=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result=new StringBuilder();for(byte part:digest)result.append(String.format("%02x",part&255));return result.toString();
        }catch(Exception impossible){throw new IllegalStateException(impossible);}
    }
    static String target(String host,String provider,String session,String job) {return hash(host+"|"+provider+"|"+(session.isEmpty()?"job:"+job:"session:"+session));}
    static String event(String host,String provider,String job,String version,String status) {return hash(host+"|"+provider+"|"+job+"|"+version+"|"+status);}
}
