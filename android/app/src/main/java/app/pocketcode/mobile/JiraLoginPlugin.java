package app.pocketcode.mobile;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "JiraLogin")
public class JiraLoginPlugin extends Plugin {
    private ServerSocket listener;
    private PluginCall waiting;
    private synchronized void stop() {
        if (listener != null) try { listener.close(); } catch (IOException ignored) {}
        listener = null;
        if (waiting != null) { waiting.reject("Вход отменён. Нажмите Connect, чтобы повторить."); waiting = null; }
    }
    @PluginMethod public synchronized void prepare(PluginCall call) {
        stop();
        try {
            listener = new ServerSocket(0, 4, InetAddress.getByName("127.0.0.1"));
            listener.setSoTimeout(300000);
            JSObject result = new JSObject(); result.put("redirectUrl", "http://127.0.0.1:" + listener.getLocalPort() + "/jira-callback"); call.resolve(result);
        } catch (Exception e) { call.reject("Не удалось подготовить вход Jira"); }
    }
    @PluginMethod public synchronized void open(PluginCall call) {
        boolean russian = "ru".equals(call.getString("language", "en"));
        String url = call.getString("url"), state = call.getString("state");
        Uri target = url == null ? null : Uri.parse(url);
        if (listener == null || target == null || !"https".equals(target.getScheme()) ||
            !("mcp.atlassian.com".equals(target.getHost()) || "id.atlassian.com".equals(target.getHost()) || "auth.atlassian.com".equals(target.getHost())) || state == null || state.length() < 32) {
            call.reject("Неверный адрес входа Atlassian"); return;
        }
        ServerSocket current = listener; waiting = call;
        new Thread(() -> {
            long deadline = System.currentTimeMillis() + 300000;
            try {
                while (!current.isClosed() && System.currentTimeMillis() < deadline) {
                    current.setSoTimeout((int)Math.max(1, deadline - System.currentTimeMillis()));
                    try (Socket socket = current.accept()) {
                        socket.setSoTimeout(3000);
                        InputStream input = socket.getInputStream(); ByteArrayOutputStream line = new ByteArrayOutputStream();
                        for (int i=0; i<16384; i++) { int value = input.read(); if (value == -1 || value == '\n') break; line.write(value); }
                        String[] parts = line.toString("UTF-8").trim().split(" ");
                        // Consume request headers before closing so the browser receives the response cleanly.
                        int matched = 0;
                        for (int i=0; i<32768 && matched<4; i++) { int value=input.read(); if (value<0) break; int expected=(matched==0 || matched==2) ? '\r' : '\n'; matched=value==expected ? matched+1 : value=='\r' ? 1 : 0; }
                        Uri callback = parts.length >= 2 ? Uri.parse("http://127.0.0.1" + parts[1]) : Uri.EMPTY;
                        boolean valid = parts.length >= 2 && "GET".equals(parts[0]) && "/jira-callback".equals(callback.getPath()) && state.equals(callback.getQueryParameter("state"));
                        String code = valid ? callback.getQueryParameter("code") : null;
                        String html = "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Pocket Code</title><h2>" + (valid ? (russian ? "Вернитесь в Pocket Code" : "Return to Pocket Code") : (russian ? "Неверный запрос" : "Invalid request")) + "</h2><p>" + (valid ? (russian ? "Закройте эту вкладку и вернитесь в приложение, чтобы завершить подключение Jira." : "Close this tab and return to the app to finish connecting Jira.") : (russian ? "Продолжите вход в окне Atlassian." : "Continue signing in on the Atlassian page.")) + "</p>";
                        byte[] body = html.getBytes(StandardCharsets.UTF_8);
                        String headers = "HTTP/1.1 " + (valid ? "200 OK" : "400 Bad Request") + "\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'\r\nConnection: close\r\nContent-Length: " + body.length + "\r\n\r\n";
                        socket.getOutputStream().write(headers.getBytes(StandardCharsets.US_ASCII)); socket.getOutputStream().write(body); socket.getOutputStream().flush();
                        if (!valid) continue;
                        synchronized (this) {
                            if (waiting != call) return;
                            waiting = null;
                            if (code == null || code.length() > 8192) call.reject("Вход в Atlassian отменён или отклонён");
                            else { JSObject result = new JSObject(); result.put("code", code); result.put("state", state); result.put("issuer", callback.getQueryParameter("iss")); call.resolve(result); }
                        }
                        break;
                    } catch (SocketTimeoutException ignored) {}
                }
            } catch (Exception ignored) {} finally {
                synchronized (this) { if (listener == current) stop(); else try { current.close(); } catch (IOException ignored) {} }
            }
        }, "jira-oauth-callback").start();
        getActivity().runOnUiThread(() -> {
            try { getActivity().startActivity(new Intent(Intent.ACTION_VIEW, target)); }
            catch (Exception e) { stop(); }
        });
    }
    @PluginMethod public synchronized void cancel(PluginCall call) { stop(); call.resolve(); }
    @Override protected void handleOnDestroy() { stop(); super.handleOnDestroy(); }
}
