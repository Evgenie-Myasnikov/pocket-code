package app.pocketcode.mobile;

import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Navigation")
public class NavigationPlugin extends Plugin {
    @PluginMethod public void embeddedBoards(PluginCall call) {
        com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
        result.put("supported", androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.WEB_MESSAGE_LISTENER)
            && !getBridge().getConfig().isUsingLegacyBridge());
        call.resolve(result);
    }
    @Override public void load() {
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                getBridge().triggerWindowJSEvent("pocket-code-back", "{}");
            }
        });
    }
    /** Status and navigation bar icons follow the app theme (not the system one); the background is kept so the next cold start paints it before the WebView draws. */
    @PluginMethod public void systemBars(PluginCall call) {
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", true));
        String background = call.getString("background", "");
        int color;
        try { color = android.graphics.Color.parseColor(background); } catch (IllegalArgumentException error) { call.reject("Invalid background colour"); return; }
        getActivity().getSharedPreferences(MainActivity.THEME_PREFERENCES, android.content.Context.MODE_PRIVATE).edit().putInt(MainActivity.THEME_BACKGROUND, color).putBoolean(MainActivity.THEME_DARK, dark).apply();
        getActivity().runOnUiThread(() -> { MainActivity.applySystemBars(getActivity(), dark, color); call.resolve(); });
    }
    @PluginMethod public void minimize(PluginCall call) {
        getActivity().runOnUiThread(() -> { getActivity().moveTaskToBack(true); call.resolve(); });
    }
}
