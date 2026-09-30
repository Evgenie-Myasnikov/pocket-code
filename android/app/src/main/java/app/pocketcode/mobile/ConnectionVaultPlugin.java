package app.pocketcode.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "ConnectionVault")
public class ConnectionVaultPlugin extends Plugin {
    private static final String ALIAS = "pocket-code-connection";
    private SharedPreferences prefs() { return getContext().getSharedPreferences("connection-vault", Context.MODE_PRIVATE); }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    @PluginMethod public void save(PluginCall call) {
        try {
            String value = call.getString("value");
            if (value == null || value.length() > 8192) { call.reject("Invalid connection"); return; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            String encrypted = Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
            if (!prefs().edit().putString("data", encrypted).putString("iv", iv).commit()) throw new Exception("Storage failed");
            call.resolve();
        } catch (Exception error) { call.reject("Cannot save connection securely"); }
    }
    @PluginMethod public void load(PluginCall call) {
        try {
            String data = prefs().getString("data", null), iv = prefs().getString("iv", null);
            JSObject result = new JSObject();
            if (data != null && iv != null) {
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
                result.put("value", new String(cipher.doFinal(Base64.decode(data, Base64.NO_WRAP)), StandardCharsets.UTF_8));
            }
            call.resolve(result);
        } catch (Exception error) { call.reject("Cannot restore connection"); }
    }
    @PluginMethod public void clear(PluginCall call) {
        if (prefs().edit().clear().commit()) call.resolve(); else call.reject("Cannot clear connection");
    }
}
