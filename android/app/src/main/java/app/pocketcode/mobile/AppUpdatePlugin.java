package app.pocketcode.mobile;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private volatile File ready;
    private File updateFile() { return new File(new File(getContext().getCacheDir(), "updates"), "update.apk"); }
    private long version(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    private int flags() { return Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES; }
    private Set<String> signers(PackageInfo info) throws Exception {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28 ? info.signingInfo.getApkContentsSigners() : info.signatures;
        Set<String> result = new HashSet<>();
        for (Signature signature : signatures) result.add(hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        return result;
    }
    private String hex(byte[] bytes) { StringBuilder text = new StringBuilder(); for (byte b : bytes) text.append(String.format("%02x", b & 255)); return text.toString(); }
    private PackageInfo verify(File file) throws Exception {
        PackageManager manager = getContext().getPackageManager();
        PackageInfo candidate = manager.getPackageArchiveInfo(file.getAbsolutePath(), flags());
        PackageInfo installed = manager.getPackageInfo(getContext().getPackageName(), flags());
        if (candidate == null || !installed.packageName.equals(candidate.packageName) || version(candidate) <= version(installed) || signers(candidate).isEmpty() || !signers(installed).equals(signers(candidate))) throw new Exception("Update package or signing certificate does not match this app.");
        return candidate;
    }
    @PluginMethod public void info(PluginCall call) {
        try {
            PackageInfo current = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject result = new JSObject(); result.put("version", current.versionName); result.put("versionCode", version(current)); call.resolve(result);
        } catch (Exception e) { call.reject("Could not read installed app version."); }
    }
    @PluginMethod public void download(PluginCall call) {
        String address = call.getString("url", ""), token = call.getString("token", ""), expected = call.getString("sha256", "");
        Long release = UpdateNumbers.positiveInteger(call.getData().opt("releaseId")), expectedSize = UpdateNumbers.positiveInteger(call.getData().opt("size")), expectedCode = UpdateNumbers.positiveInteger(call.getData().opt("versionCode"));
        try {
            URL base = new URL(address);
            String host = base.getHost();
            boolean privateHost = host.equals("localhost") || host.equals("127.0.0.1") || host.matches("10\\..*|192\\.168\\..*|172\\.(1[6-9]|2[0-9]|3[01])\\..*|100\\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\\..*");
            if (!(base.getProtocol().equals("https") || base.getProtocol().equals("http") && privateHost) || base.getUserInfo() != null || base.getQuery() != null || base.getRef() != null || !(base.getPath().isEmpty() || base.getPath().equals("/")) || token.length() < 32 || token.contains("\n") || token.contains("\r") || !expected.matches("[a-f0-9]{64}") || release == null || release <= 0 || expectedSize == null || expectedSize < 1 || expectedSize > 200000000 || expectedCode == null || expectedCode < 1) throw new Exception();
        } catch (Exception e) { call.reject("Invalid update source."); return; }
        URL source;
        try { source = new URL(address.replaceAll("/$", "") + "/api/updates/download?release=" + release); }
        catch (Exception e) { call.reject("Invalid update source."); return; }
        transfer(call, source, token, expectedSize, expected, expectedCode);
    }
    @PluginMethod public void downloadRelease(PluginCall call) {
        String expected = call.getString("sha256", "");
        Long expectedSize = UpdateNumbers.positiveInteger(call.getData().opt("size")), expectedCode = UpdateNumbers.positiveInteger(call.getData().opt("versionCode"));
        URL source;
        try {
            source = ReleaseSource.apk(call.getString("version", ""));
            if (!expected.matches("[a-f0-9]{64}") || expectedSize == null || expectedSize < 1 || expectedSize > 200000000 || expectedCode == null || expectedCode < 1) throw new Exception();
        } catch (Exception e) { call.reject("Invalid update source."); return; }
        transfer(call, source, null, expectedSize, expected, expectedCode);
    }
    // A null token means the public GitHub release; the PC path keeps its key on one direct connection.
    private void transfer(PluginCall call, URL source, String token, long expectedSize, String expected, long expectedCode) {
        if (!downloading.compareAndSet(false, true)) { call.reject("An update is already downloading."); return; }
        ready = null;
        new Thread(() -> {
            HttpURLConnection connection = null; File partial = new File(updateFile().getParentFile(), "update.part");
            try {
                partial.getParentFile().mkdirs();
                URL current = source;
                for (int hop = 0; ; hop++) {
                    connection = (HttpURLConnection) current.openConnection();
                    connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(15000); connection.setReadTimeout(240000);
                    if (token != null) connection.setRequestProperty("Authorization", "Bearer " + token);
                    int status = connection.getResponseCode();
                    if (token == null && status >= 300 && status < 400 && hop < 5) { URL next = ReleaseSource.redirect(current, connection.getHeaderField("Location")); connection.disconnect(); connection = null; current = next; continue; }
                    if (status != 200) throw new Exception(token == null ? "GitHub did not provide this release. Check for updates again." : "The PC could not download this release. Check for updates again.");
                    break;
                }
                MessageDigest digest = MessageDigest.getInstance("SHA-256"); long received = 0;
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
                    byte[] buffer = new byte[65536]; int count;
                    while ((count = input.read(buffer)) != -1) {
                        received += count; if (received > expectedSize) throw new Exception("Unexpected update size.");
                        digest.update(buffer, 0, count); output.write(buffer, 0, count);
                    }
                }
                if (received != expectedSize || !hex(digest.digest()).equals(expected)) throw new Exception("Update checksum verification failed.");
                if (version(verify(partial)) != expectedCode) throw new Exception("Update version does not match the release.");
                File target = updateFile(); if (target.exists() && !target.delete()) throw new Exception("Could not replace the previous download.");
                if (!partial.renameTo(target)) throw new Exception("Could not save the update.");
                ready = target; call.resolve();
            } catch (Exception e) { partial.delete(); call.reject(e.getMessage() == null ? "Could not download the update." : e.getMessage()); }
            finally { if (connection != null) connection.disconnect(); downloading.set(false); }
        }, "pocket-update").start();
    }
    @PluginMethod public void install(PluginCall call) {
        try {
            String expected = call.getString("sha256", ""); Long expectedCode = UpdateNumbers.positiveInteger(call.getData().opt("versionCode"));
            if (downloading.get() || !expected.matches("[a-f0-9]{64}") || expectedCode == null || expectedCode < 1) throw new Exception();
            File file = ready != null ? ready : updateFile();
            if (version(verify(file)) != expectedCode) throw new Exception();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = new FileInputStream(file)) {
                byte[] buffer = new byte[65536]; int count;
                while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
            }
            if (!hex(digest.digest()).equals(expected)) throw new Exception();
            if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) { JSObject result = new JSObject(); result.put("needsPermission", true); call.resolve(result); return; }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent); JSObject result = new JSObject(); result.put("needsPermission", false); call.resolve(result);
        } catch (Exception e) { call.reject("Could not open the Android installer. Download the update again."); }
    }
    @PluginMethod public void allowInstall(PluginCall call) {
        try { if (Build.VERSION.SDK_INT >= 26) getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()))); call.resolve(); }
        catch (Exception e) { call.reject("Open Android Settings and allow Pocket Code to install apps."); }
    }
    @PluginMethod public void openDocument(PluginCall call) {
        try {
            String encoded = call.getString("data", "");
            if (encoded.length() > 14000000) throw new Exception();
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            if (bytes.length < 5 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F' || bytes[4] != '-') throw new Exception();
            File directory = new File(getContext().getCacheDir(), "documents"); directory.mkdirs();
            File file = new File(directory, java.util.UUID.randomUUID().toString() + ".pdf");
            try (FileOutputStream output = new FileOutputStream(file)) { output.write(bytes); }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
            call.resolve();
        } catch (Exception e) { call.reject("Could not open the PDF. Check that a PDF viewer is installed."); }
    }
}
