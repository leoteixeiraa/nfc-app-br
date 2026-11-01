package br.com.nfcapp.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;

class FirebaseTokenVerifierTest {

    @Test
    void acceptsVerifiedGoogleIdentity() {
        FirebaseTokenVerifier verifier = verifierFor(jwt("google.com", true, "ana@example.com"));

        FirebaseIdentity identity = verifier.verify("token");

        assertThat(identity.uid()).isEqualTo("uid-1");
        assertThat(identity.email()).isEqualTo("ana@example.com");
        assertThat(identity.name()).isEqualTo("Ana");
    }

    @Test
    void rejectsOtherProviders() {
        FirebaseTokenVerifier verifier = verifierFor(jwt("password", true, "ana@example.com"));

        assertThatThrownBy(() -> verifier.verify("token")).isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsUnverifiedEmail() {
        FirebaseTokenVerifier verifier = verifierFor(jwt("google.com", false, "ana@example.com"));

        assertThatThrownBy(() -> verifier.verify("token")).isInstanceOf(JwtException.class);
    }

    private static FirebaseTokenVerifier verifierFor(Jwt jwt) {
        return new FirebaseTokenVerifier(token -> jwt);
    }

    private static Jwt jwt(String provider, boolean emailVerified, String email) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject("uid-1")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(300))
                .claim("email", email)
                .claim("email_verified", emailVerified)
                .claim("name", "Ana")
                .claim("firebase", Map.of("sign_in_provider", provider))
                .build();
    }
}
