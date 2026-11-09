package br.com.nfcapp.tags;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;

import org.junit.jupiter.api.Test;

class TagRateLimiterTest {
    @Test
    void enforcesConfiguredLimitPerScope() {
        TagRateLimiter limiter = new TagRateLimiter();
        assertTrue(limiter.allow("create:127.0.0.1", 1, Duration.ofMinutes(1)));
        assertFalse(limiter.allow("create:127.0.0.1", 1, Duration.ofMinutes(1)));
        assertTrue(limiter.allow("places:127.0.0.1", 1, Duration.ofMinutes(1)));
    }
}
