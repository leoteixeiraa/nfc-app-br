package br.com.nfcapp.tags;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

@Component
public class TagRateLimiter {
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public boolean allow(String key, int limit, Duration duration) {
        Instant now = Instant.now();
        Window window = windows.compute(key, (ignored, current) -> {
            if (current == null || current.startedAt().plus(duration).isBefore(now)) {
                return new Window(now, 1, duration);
            }
            return new Window(current.startedAt(), current.count() + 1, current.duration());
        });
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(entry -> entry.getValue().startedAt()
                    .plus(entry.getValue().duration().multipliedBy(2)).isBefore(now));
        }
        return window.count() <= limit;
    }

    private record Window(Instant startedAt, int count, Duration duration) {
    }
}
