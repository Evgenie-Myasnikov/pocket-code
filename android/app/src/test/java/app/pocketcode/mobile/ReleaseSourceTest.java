package app.pocketcode.mobile;
import java.net.URL;
import org.junit.Test;
import static org.junit.Assert.*;
public class ReleaseSourceTest {
    private static void rejected(ThrowingRunnable action){try{action.run();fail("Expected rejection");}catch(Exception expected){}}
    private interface ThrowingRunnable{void run() throws Exception;}
    @Test public void releaseAssetIsTheOnlySource() throws Exception {assertEquals("https://github.com/Evgenie-Myasnikov/pocket-code/releases/download/v1.2.3/Pocket-Code-1.2.3.apk",ReleaseSource.apk("1.2.3").toString());}
    @Test public void malformedVersionsAreRejected(){for(String version:new String[]{null,"","1.2","1.2.3.4","1.2.x","../1.2.3","1.2.3/../../x","12345.0.0"})rejected(()->ReleaseSource.apk(version));}
    @Test public void httpsRedirectsAreFollowed() throws Exception {URL from=ReleaseSource.apk("1.2.3");assertEquals("https://release-assets.example.test/asset?sig=synthetic",ReleaseSource.redirect(from,"https://release-assets.example.test/asset?sig=synthetic").toString());assertEquals("https://github.com/other",ReleaseSource.redirect(from,"/other").toString());}
    @Test public void insecureRedirectsAreRejected() throws Exception {URL from=ReleaseSource.apk("1.2.3");for(String location:new String[]{null,"","http://downgrade.example.test/asset","https://user:secret@example.test/asset","ftp://example.test/asset"})rejected(()->ReleaseSource.redirect(from,location));}
}
