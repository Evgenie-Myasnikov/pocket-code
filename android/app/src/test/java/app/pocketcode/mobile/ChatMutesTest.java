package app.pocketcode.mobile;

import java.util.Collections;
import java.util.Set;
import org.junit.Test;
import static org.junit.Assert.*;

public class ChatMutesTest {
    @Test public void canonicalHostMatchesCaseDefaultPortAndTrailingSlashes(){
        assertEquals(ChatMutes.hostKey("HTTPS://EXAMPLE.INVALID:443/work///"),ChatMutes.hostKey("https://example.invalid/work"));
        assertEquals(ChatMutes.hostKey("http://[::1]:80/"),ChatMutes.hostKey("http://[::1]"));
        assertNotEquals(ChatMutes.hostKey("https://example.invalid/work"),ChatMutes.hostKey("https://example.invalid/Work"));
        assertNotEquals(ChatMutes.hostKey("https://example.invalid/"),ChatMutes.hostKey("https://example.invalid:444/"));
    }
    @Test public void aliasesMatchEitherIdentityInTheSameProvider(){
        Set<String> both=ChatMutes.aliases("claude","session-1","job-1");
        assertFalse(Collections.disjoint(both,ChatMutes.aliases("claude","session-1","job-2")));
        assertFalse(Collections.disjoint(both,ChatMutes.aliases("claude","new-session","job-1")));
        assertTrue(Collections.disjoint(both,ChatMutes.aliases("codex","session-1","job-1")));
        assertTrue(Collections.disjoint(both,ChatMutes.aliases("claude","job-1","session-1")));
        assertTrue(ChatMutes.aliases("claude","","").isEmpty());
    }
    @Test public void pendingSessionAndCanonicalJobAliasMatch(){
        assertEquals(ChatMutes.aliases("claude","pending-abc",""),ChatMutes.aliases("claude","","abc"));
        assertEquals(ChatMutes.aliases("claude","pending-old","current"),ChatMutes.aliases("claude","","current"));
    }
}
