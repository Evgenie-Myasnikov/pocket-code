package app.pocketcode.mobile;
public final class NotificationIdentityTest {
    private static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
    public static void main(String[] args){
        String host="https://example.invalid",session="shared-id";
        String claude=NotificationIdentity.target(host,"claude",session,"job-1");
        check(claude.equals(NotificationIdentity.target(host,"claude",session,"job-2")),"new run replaces same-chat alert");
        check(!claude.equals(NotificationIdentity.target(host,"codex",session,"job-1")),"provider-separated target");
        check(!claude.equals(NotificationIdentity.target("https://other.invalid","claude",session,"job-1")),"host-separated target");
        check(!NotificationIdentity.target(host,"claude","","one").equals(NotificationIdentity.target(host,"claude","","two")),"pending jobs remain separate");
        String event=NotificationIdentity.event(host,"claude","job-1","version-1","needs_input");
        check(event.equals(NotificationIdentity.event(host,"claude","job-1","version-1","needs_input")),"both services use the same event identity");
        check(!event.equals(NotificationIdentity.event(host,"claude","job-1","version-2","done")),"completion is fresh attention");
        check(event.matches("[0-9a-f]{64}"),"no raw connection value in notification identity");
        System.out.println("Notification identity: 7 checks passed");
    }
}
