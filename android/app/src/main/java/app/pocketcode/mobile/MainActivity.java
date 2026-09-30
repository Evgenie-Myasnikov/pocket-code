package app.pocketcode.mobile;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ConnectionVaultPlugin.class);
        registerPlugin(PairingScannerPlugin.class);
        registerPlugin(JiraLoginPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
