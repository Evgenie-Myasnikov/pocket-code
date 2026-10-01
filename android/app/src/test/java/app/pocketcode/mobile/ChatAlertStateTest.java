package app.pocketcode.mobile;
import org.junit.Test;
import static org.junit.Assert.*;
public class ChatAlertStateTest {
    @Test public void oldHistoryIsQuiet(){assertFalse(new ChatAlertState().observe("old","done",10,100));}
    @Test public void fastNewJobNotifies(){assertTrue(new ChatAlertState().observe("new","done",110,100));}
    @Test public void runningThenCompletionNotifies(){ChatAlertState state=new ChatAlertState();assertFalse(state.observe("job","running",10,100));assertTrue(state.observe("job","done",10,100));}
    @Test public void questionAndErrorNotify(){ChatAlertState state=new ChatAlertState();assertTrue(state.observe("job","needs_input",10,100));assertTrue(state.observe("job","error",10,100));}
    @Test public void unrelatedHistoryAndResetStayQuiet(){ChatAlertState state=new ChatAlertState();state.observe("job","running",10,100);assertFalse(state.observe("other","done",10,100));state.reset();assertFalse(state.observe("job","done",10,100));}
}
