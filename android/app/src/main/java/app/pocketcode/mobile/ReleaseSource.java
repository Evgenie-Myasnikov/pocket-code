package app.pocketcode.mobile;

import java.net.URL;

/** The only APK source a phone may use without a PC: this repository's published release asset. */
final class ReleaseSource {
    static final String REPOSITORY = "Evgenie-Myasnikov/pocket-code";
    private ReleaseSource() {}
    static URL apk(String version) throws Exception {
        if (version == null || !version.matches("\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}")) throw new Exception("Invalid release version.");
        return new URL("https://github.com/" + REPOSITORY + "/releases/download/v" + version + "/Pocket-Code-" + version + ".apk");
    }
    // GitHub serves release assets through HTTPS redirects; integrity still comes from the checksum and signing certificate.
    static URL redirect(URL from, String location) throws Exception {
        if (location == null || location.isEmpty()) throw new Exception("Release download redirect is missing.");
        URL next = new URL(from, location);
        if (!"https".equals(next.getProtocol()) || next.getUserInfo() != null) throw new Exception("Release download redirect is not secure.");
        return next;
    }
}
