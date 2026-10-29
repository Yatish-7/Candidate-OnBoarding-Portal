package com.intellectt.security;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.regex.Pattern;

import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Detection, not blocking: looks at the query string and small JSON bodies of API requests for the typical
 * shapes of an attack (script tags, event handlers, {@code javascript:}, SQL tautologies / UNION SELECT /
 * stacked statements, path traversal) and writes a {@code SUSPICIOUS_INPUT} line to logs/security.log. A person
 * who keeps doing it raises a {@code SUSPICIOUS_REPEAT} alert for whoever reviews the log (or a SIEM).
 * <p>
 * The request is NOT rejected here: the real protections (bound SQL parameters, validation, escaping, role
 * checks) hold regardless, and blocking on patterns would turn ordinary text (a job description that mentions
 * "drop table") into errors. The log never contains the attacker's text, only which rule matched, the HTTP
 * method and the path (no query string), and the signed-in user's email. No IP address is written.
 * <p>
 * Created by {@code SecurityConfig} (not a Spring bean) so it runs once, after {@link JwtAuthFilter}, when the
 * signed-in user is already known.
 */
public class SuspiciousInputFilter extends OncePerRequestFilter {

    private static final long MAX_BODY_BYTES = 1_000_000;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    /** Every this many suspicious requests from one user in the window, an alert line is written. */
    private static final int REPEAT_EVERY = 5;

    private record Rule(String name, Pattern pattern) {
        Rule(String name, String regex) {
            this(name, Pattern.compile(regex, Pattern.CASE_INSENSITIVE | Pattern.DOTALL));
        }
    }

    private static final List<Rule> RULES = List.of(
            new Rule("script-tag", "<\\s*/?\\s*script"),
            new Rule("html-event-handler", "\\bon(error|load|click|mouseover|focus|toggle|animationstart)\\s*="),
            new Rule("javascript-url", "javascript\\s*:"),
            new Rule("sql-tautology", "['\"]\\s*(or|and)\\s+['\"]?\\w+['\"]?\\s*=\\s*['\"]?\\w"),
            new Rule("sql-union-select", "\\bunion\\s+(all\\s+)?select\\b"),
            new Rule("sql-stacked-statement", ";\\s*(drop|alter|truncate|delete|insert|update)\\s+\\w+"),
            new Rule("sql-comment-terminator", ";\\s*--"),
            new Rule("path-traversal", "\\.\\.[/\\\\]"));

    private final AttemptLimiter limiter;

    public SuspiciousInputFilter(AttemptLimiter limiter) {
        this.limiter = limiter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        HttpServletRequest forward = request;
        StringBuilder text = new StringBuilder();
        String query = request.getQueryString();
        if (query != null) {
            text.append(decode(query)).append('\n');
        }
        String type = request.getContentType();
        long length = request.getContentLengthLong();
        if (type != null && type.toLowerCase().contains("json") && length <= MAX_BODY_BYTES
                && !"GET".equals(request.getMethod())) {
            byte[] body = request.getInputStream().readNBytes((int) MAX_BODY_BYTES + 1);
            forward = new CachedBodyRequest(request, body); // the controller still gets to read the body
            if (body.length <= MAX_BODY_BYTES) {
                text.append(new String(body, StandardCharsets.UTF_8));
            }
        }

        String hit = firstMatch(text.toString());
        if (hit != null) {
            String who = SecurityEvents.currentUser();
            SecurityEvents.warn("SUSPICIOUS_INPUT", who, "rule=" + hit + " " + request.getMethod() + " " + request.getRequestURI());
            int count = limiter.record("suspicious:" + ("-".equals(who) ? "anonymous" : who), WINDOW);
            if (count % REPEAT_EVERY == 0) {
                SecurityEvents.warn("SUSPICIOUS_REPEAT", who, count + " suspicious requests in 15 minutes: review, and"
                        + " deactivate the account or end its sessions if it is not a mistake");
            }
        }
        chain.doFilter(forward, response);
    }

    private static String firstMatch(String text) {
        if (text.isEmpty()) {
            return null;
        }
        for (Rule rule : RULES) {
            if (rule.pattern().matcher(text).find()) {
                return rule.name();
            }
        }
        return null;
    }

    private static String decode(String s) {
        try {
            return URLDecoder.decode(s, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return s; // malformed %-escape: scan it as it is
        }
    }

    /** Lets the body be read twice: once here, once by the controller. */
    private static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream in = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public int read() {
                    return in.read();
                }

                @Override
                public int read(byte[] b, int off, int len) {
                    return in.read(b, off, len);
                }

                @Override
                public boolean isFinished() {
                    return in.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException();
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            String enc = getCharacterEncoding();
            return new BufferedReader(new InputStreamReader(getInputStream(),
                    enc != null ? java.nio.charset.Charset.forName(enc) : StandardCharsets.UTF_8));
        }
    }
}
