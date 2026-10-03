package app.pocketcode.mobile;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ConnectionVaultPlugin.class);
        registerPlugin(PairingScannerPlugin.class);
        registerPlugin(JiraLoginPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(NavigationPlugin.class);
        registerPlugin(ChatNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
        // External frames must never inherit Capacitor's legacy JavaScript interface.
        if (androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.WEB_MESSAGE_LISTENER)
            && !getBridge().getConfig().isUsingLegacyBridge()) {
            getBridge().getWebView().removeJavascriptInterface("androidBridge");
        }
    }
    @Override protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if(getBridge()!=null)getBridge().triggerWindowJSEvent("pocket-code-notification", "{}");
    }
}
