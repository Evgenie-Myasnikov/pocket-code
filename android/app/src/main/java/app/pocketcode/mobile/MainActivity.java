package app.pocketcode.mobile;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    static final String THEME_PREFERENCES = "pocket_code_theme", THEME_BACKGROUND = "background", THEME_DARK = "dark";
    /** Bar icons contrast with the app background; the window behind the WebView uses the same colour, so there is no dark or light flash between splash and first paint. */
    static void applySystemBars(android.app.Activity activity, boolean dark, int background) {
        activity.getWindow().getDecorView().setBackgroundColor(background);
        androidx.core.view.WindowInsetsControllerCompat bars = androidx.core.view.WindowCompat.getInsetsController(activity.getWindow(), activity.getWindow().getDecorView());
        bars.setAppearanceLightStatusBars(!dark);
        bars.setAppearanceLightNavigationBars(!dark);
    }
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ConnectionVaultPlugin.class);
        registerPlugin(PairingScannerPlugin.class);
        registerPlugin(JiraLoginPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(NavigationPlugin.class);
        registerPlugin(ChatNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
        androidx.activity.EdgeToEdge.enable(this);
        android.content.SharedPreferences theme = getSharedPreferences(THEME_PREFERENCES, MODE_PRIVATE);
        if (theme.contains(THEME_BACKGROUND)) {
            int background = theme.getInt(THEME_BACKGROUND, 0xff111512);
            applySystemBars(this, theme.getBoolean(THEME_DARK, true), background);
            getBridge().getWebView().setBackgroundColor(background);
        }
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
