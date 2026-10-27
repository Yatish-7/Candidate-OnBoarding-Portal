package com.intellectt.security;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * In-memory counters for rate limiting: how many times a key (an account, an IP,
 * an account+IP pair) did something within a time window. Used to stop password
 * guessing and reset-email flooding. Nothing here is stored in the database; IPs
 * only live in memory for the length of the window.
 *
 * Counters are per backend instance, which is fine for one instance. With several
 * instances behind a load balancer each keeps its own count, so the effective limit
 * is multiplied by the number of instances.
 */
@Component
public class AttemptLimiter {

    /** Purge expired entries once the map gets this big, so it can't grow without limit. */
    private static final int CLEANUP_THRESHOLD = 10_000;

    private record Window(int count, long startedAtMs) {
    }

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    /** True if {@code key} already reached {@code limit} within the current window. */
    public boolean isBlocked(String key, int limit, Duration window) {
        Window w = windows.get(key);
        return w != null && !expired(w, window) && w.count() >= limit;
    }

    /** Counts one more attempt for {@code key}; returns the new count in the current window. */
    public int record(String key, Duration window) {
        if (windows.size() > CLEANUP_THRESHOLD) {
            windows.entrySet().removeIf(e -> expired(e.getValue(), window));
        }
        return windows.compute(key, (k, w) -> (w == null || expired(w, window))
                ? new Window(1, System.currentTimeMillis())
                : new Window(w.count() + 1, w.startedAtMs())).count();
    }

    /** Seconds until {@code key}'s window ends (at least 1). */
    public long secondsLeft(String key, Duration window) {
        Window w = windows.get(key);
        if (w == null) {
            return 1;
        }
        long leftMs = w.startedAtMs() + window.toMillis() - System.currentTimeMillis();
        return Math.max(1, (leftMs + 999) / 1000);
    }

    public void reset(String key) {
        windows.remove(key);
    }

    private static boolean expired(Window w, Duration window) {
        return System.currentTimeMillis() - w.startedAtMs() >= window.toMillis();
    }
}
