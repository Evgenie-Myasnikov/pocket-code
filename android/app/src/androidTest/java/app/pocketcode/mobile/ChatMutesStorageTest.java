package app.pocketcode.mobile;

import android.content.Context;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class ChatMutesStorageTest {
    @Test public void replacingOneHostSnapshotLeavesOtherHostsAndOtherChatsAlone() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        String host="https://mute-fixture.invalid",other="https://separate-fixture.invalid";
        JSONArray muted=new JSONArray().put(new JSONObject().put("provider","claude").put("sessionId","first").put("jobId","turn"));
        try{
            ChatMutes.replace(context,host+"/",muted);
            ChatMutes.replace(context,other,muted);
            assertTrue(ChatMutes.contains(context,host,"claude","first","next"));
            assertTrue(ChatMutes.contains(context,host,"claude","pending-turn","turn"));
            assertFalse(ChatMutes.contains(context,host,"codex","first","turn"));
            assertFalse(ChatMutes.contains(context,host,"claude","second","another"));
            ChatMutes.replace(context,host,new JSONArray());
            assertFalse(ChatMutes.contains(context,host,"claude","first","turn"));
            assertTrue(ChatMutes.contains(context,other,"claude","first","turn"));
        }finally{
            ChatMutes.replace(context,host,new JSONArray());
            ChatMutes.replace(context,other,new JSONArray());
        }
    }
}
