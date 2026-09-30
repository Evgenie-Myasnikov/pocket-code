package app.pocketcode.mobile;

import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Navigation")
public class NavigationPlugin extends Plugin {
    @Override public void load() {
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                getBridge().triggerWindowJSEvent("pocket-code-back", "{}");
            }
        });
    }
    @PluginMethod public void minimize(PluginCall call) {
        getActivity().runOnUiThread(() -> { getActivity().moveTaskToBack(true); call.resolve(); });
    }
}
