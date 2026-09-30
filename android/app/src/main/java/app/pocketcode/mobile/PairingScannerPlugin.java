package app.pocketcode.mobile;

import android.Manifest;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.journeyapps.barcodescanner.ScanOptions;

@CapacitorPlugin(name = "PairingScanner", permissions = {
    @Permission(alias = "camera", strings = { Manifest.permission.CAMERA })
})
public class PairingScannerPlugin extends Plugin {
    private boolean scanning = false;

    @PluginMethod public void scan(PluginCall call) {
        if (scanning) { call.reject("Сканер уже открыт"); return; }
        scanning = true;
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermissionResult");
        } else { openScanner(call); }
    }

    @PermissionCallback private void cameraPermissionResult(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) openScanner(call);
        else {
            scanning = false;
            call.reject("Разрешите доступ к камере в настройках Android или выберите изображение QR-кода.");
        }
    }

    private void openScanner(PluginCall call) {
        try {
            ScanOptions options = new ScanOptions();
            options.setDesiredBarcodeFormats(ScanOptions.QR_CODE);
            options.setPrompt("ru".equals(call.getString("language", "en")) ? "Наведите камеру на QR-код Pocket Code на вашем ПК" : "Point the camera at the Pocket Code QR on your PC");
            options.setBeepEnabled(false);
            options.setBarcodeImageEnabled(false);
            options.setOrientationLocked(false);
            startActivityForResult(call, options.createScanIntent(getContext()), "scanResult");
        } catch (Exception error) {
            scanning = false;
            call.reject("Не удалось открыть камеру. Попробуйте QR из изображения.");
        }
    }

    @ActivityCallback private void scanResult(PluginCall call, ActivityResult result) {
        scanning = false;
        if (call == null) return;
        Intent data = result.getData();
        String value = data == null ? null : data.getStringExtra("SCAN_RESULT");
        JSObject response = new JSObject();
        if (value == null) response.put("cancelled", true);
        else response.put("value", value);
        call.resolve(response);
    }
}
