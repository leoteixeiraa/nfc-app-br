package br.com.nfcapp.auth;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@RestController
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final SecurityContextRepository securityContextRepository = new HttpSessionSecurityContextRepository();
    private final FirebaseTokenVerifier tokenVerifier;
    private final UserAccountService userAccountService;

    public AuthController(FirebaseTokenVerifier tokenVerifier, UserAccountService userAccountService) {
        this.tokenVerifier = tokenVerifier;
        this.userAccountService = userAccountService;
    }

    @GetMapping("/api/auth/csrf")
    public CsrfResponse csrfToken(CsrfToken csrfToken) {
        return new CsrfResponse(csrfToken.getToken());
    }

    @PostMapping("/api/auth/session")
    public CurrentUser createSession(
            @Valid @RequestBody SessionRequest sessionRequest,
            HttpServletRequest request,
            HttpServletResponse response) {
        FirebaseIdentity identity;
        try {
            identity = tokenVerifier.verify(sessionRequest.idToken());
        } catch (JwtException exception) {
            log.warn("Firebase ID token rejected: {}", exception.getMessage());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google credentials");
        }

        CurrentUser user;
        try {
            user = userAccountService.saveAccount(identity);
        } catch (EmailAlreadyLinkedException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage());
        }

        if (request.getSession(false) != null) {
            request.changeSessionId();
        }

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
        return user;
    }

    @GetMapping("/api/auth/me")
    public CurrentUser currentUser(@AuthenticationPrincipal CurrentUser sessionUser) {
        if (sessionUser == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        CurrentUser user = userAccountService.findById(sessionUser.id());
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return user;
    }

    public record CsrfResponse(String token) {
    }

    public record SessionRequest(@NotBlank @Size(max = 8192) String idToken) {
    }
}
