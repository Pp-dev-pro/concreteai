import com.catalyst.advanced.CatalystAdvancedIOHandler;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.OutputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Catalyst Advanced I/O function "concrete_proxy".
 * Receives {"data":{...}} from the website, adds the secret headers and calls QuickML.
 * Secrets come from environment variables, never from the browser.
 *
 * Environment variables (set in Catalyst console > function > Configuration):
 *   QUICKML_URL          e.g. https://api.catalyst.zoho.in/quickml/v1/project/<id>/endpoints/predict
 *   QUICKML_ENDPOINT_KEY value of X-QUICKML-ENDPOINT-KEY
 *   CATALYST_ORG         e.g. 60092144905
 *   CATALYST_ENV         Development or Production
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN   (scope QuickML.deployment.READ)
 *   ZOHO_ACCOUNTS_URL    optional, default https://accounts.zoho.in
 */
public class ConcreteProxy implements CatalystAdvancedIOHandler {
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private static String token; private static long expiresAt;

    @Override
    public void runner(HttpServletRequest req, HttpServletResponse res) throws Exception {
        res.setContentType("application/json;charset=UTF-8");
        try {
            if (!"POST".equalsIgnoreCase(req.getMethod())) { send(res, 405, "{\"error\":\"POST only\"}"); return; }
            String body = new String(req.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (body.isBlank() || !body.contains("\"data\"")) { send(res, 400, "{\"error\":\"Body must be {\\\"data\\\":{...}}\"}"); return; }

            HttpRequest r = HttpRequest.newBuilder(URI.create(env("QUICKML_URL")))
                .timeout(Duration.ofSeconds(25))
                .header("Content-Type", "application/json")
                .header("X-QUICKML-ENDPOINT-KEY", env("QUICKML_ENDPOINT_KEY"))
                .header("Authorization", "Zoho-oauthtoken " + accessToken())
                .header("CATALYST-ORG", env("CATALYST_ORG"))
                .header("Environment", System.getenv().getOrDefault("CATALYST_ENV", "Development"))
                .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            HttpResponse<String> out = HTTP.send(r, HttpResponse.BodyHandlers.ofString());
            send(res, out.statusCode(), out.body());
        } catch (Exception e) {
            String m = String.valueOf(e.getMessage()).replace("\\", " ").replace("\"", "'");
            send(res, 500, "{\"error\":\"Proxy failure\",\"message\":\"" + m + "\"}");
        }
    }

    /** Gets a fresh OAuth access token from the refresh token (tokens last 1 hour). */
    private static synchronized String accessToken() throws Exception {
        if (token != null && System.currentTimeMillis() < expiresAt - 60_000) return token;
        String form = "grant_type=refresh_token"
            + "&client_id=" + enc(env("ZOHO_CLIENT_ID"))
            + "&client_secret=" + enc(env("ZOHO_CLIENT_SECRET"))
            + "&refresh_token=" + enc(env("ZOHO_REFRESH_TOKEN"));
        String base = System.getenv().getOrDefault("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.in");
        HttpResponse<String> r = HTTP.send(HttpRequest.newBuilder(URI.create(base + "/oauth/v2/token"))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form)).build(), HttpResponse.BodyHandlers.ofString());
        String j = r.body(); int i = j.indexOf("\"access_token\"");
        if (i < 0) throw new IllegalStateException("OAuth refresh failed: " + j);
        int a = j.indexOf('"', j.indexOf(':', i) + 1) + 1;
        token = j.substring(a, j.indexOf('"', a)); expiresAt = System.currentTimeMillis() + 3_300_000L;
        return token;
    }
    private static String env(String k) { String v = System.getenv(k); if (v == null || v.isBlank()) throw new IllegalStateException("Missing environment variable " + k); return v; }
    private static String enc(String s) { return URLEncoder.encode(s, StandardCharsets.UTF_8); }
    private static void send(HttpServletResponse res, int code, String json) throws Exception {
        res.setStatus(code); OutputStream o = res.getOutputStream(); o.write(json.getBytes(StandardCharsets.UTF_8)); o.flush();
    }
}
