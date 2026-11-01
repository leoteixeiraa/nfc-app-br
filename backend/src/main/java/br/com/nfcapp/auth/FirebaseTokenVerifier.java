package br.com.nfcapp.auth;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class FirebaseTokenVerifier {

    private static final String JWK_SET_URI =
            "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
    private static final String GOOGLE_PROVIDER = "google.com";

    private final JwtDecoder decoder;

    @Autowired
    public FirebaseTokenVerifier(@Value("${app.firebase.project-id}") String projectId) {
        this(createDecoder(projectId));
    }

    FirebaseTokenVerifier(JwtDecoder decoder) {
        this.decoder = decoder;
    }

    public FirebaseIdentity verify(String idToken) {
        Jwt jwt = decoder.decode(idToken);

        Object firebaseClaim = jwt.getClaim("firebase");
        Object provider = firebaseClaim instanceof Map<?, ?> firebase ? firebase.get("sign_in_provider") : null;
        if (!GOOGLE_PROVIDER.equals(provider)) {
            throw new JwtException("Only Google sign-in is allowed");
        }
        if (!Boolean.TRUE.equals(jwt.getClaim("email_verified")) || !StringUtils.hasText(jwt.getClaimAsString("email"))) {
            throw new JwtException("A verified Google email address is required");
        }

        return new FirebaseIdentity(
                jwt.getSubject(),
                jwt.getClaimAsString("email"),
                jwt.getClaimAsString("name"),
                jwt.getClaimAsString("picture"));
    }

    private static JwtDecoder createDecoder(String projectId) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(JWK_SET_URI).build();
        OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer("https://securetoken.google.com/" + projectId),
                new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
                        audience -> audience != null && audience.contains(projectId)),
                new JwtClaimValidator<String>(JwtClaimNames.SUB, StringUtils::hasText));
        decoder.setJwtValidator(validator);
        return decoder;
    }
}
