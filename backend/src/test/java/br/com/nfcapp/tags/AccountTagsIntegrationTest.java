package br.com.nfcapp.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.nfcapp.auth.CurrentUser;
import br.com.nfcapp.plans.PlanService;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@EnabledIfEnvironmentVariable(named = "NFCAPP_ACCOUNT_INTEGRATION_TEST", matches = "true")
@TestPropertySource(properties = { "app.firebase.project-id=integration-test" })
class AccountTagsIntegrationTest {
    @Autowired
    private TagService tags;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private MockMvc mvc;
    @Autowired
    private PlanService plans;

    @Test
    void claimsThreePublishedTagsIdempotentlyAndIsolatesAccounts() {
        UUID user = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email) VALUES (?, ?), (?, ?)",
                user, user + "@example.test", other, other + "@example.test");
        plans.createPersonalOrganization(user);
        plans.createPersonalOrganization(other);
        List<TagService.TagClaim> claims = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            String token = String.valueOf(i + 1).repeat(64);
            claims.add(new TagService.TagClaim(legacyTag("Placa " + i, "https://example.com/" + i, token), token));
        }

        assertEquals(3, tags.claimPublishedTags(user, claims).size());
        assertEquals(3, tags.claimPublishedTags(user, claims).size());
        assertEquals(3, tags.listForAccount(user).size());
        assertEquals(0, tags.listForAccount(other).size());
        assertEquals(new BigDecimal("49.90"), tags.listForAccount(user).getFirst().salePrice());
        assertEquals("https://example.com/0", tags.findPublicDestination(claims.getFirst().code()).target());
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> tags.claimPublishedTags(other, List.of(claims.getFirst()))).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
                () -> tags.deactivateForAccount(other, claims.getFirst().code())).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
                () -> tags.deactivate(null, claims.getFirst().code(), claims.getFirst().managementToken())).getStatusCode());
    }

    @Test
    void rejectsWrongCredentialAndDuplicateEntries() {
        UUID user = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email) VALUES (?, ?)", user, user + "@example.test");
        plans.createPersonalOrganization(user);
        String token = "a".repeat(64);
        String code = legacyTag("Loja", "https://example.com", token);
        var valid = new TagService.TagClaim(code, token);
        var invalid = new TagService.TagClaim(code, "b".repeat(64));
        assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class,
                () -> tags.claimPublishedTags(user, List.of(invalid))).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
                () -> tags.claimPublishedTags(user, List.of(valid, valid))).getStatusCode());
    }

    @Test
    void accountEndpointRequiresAuthenticationAndReturnsOnlyOwnTags() throws Exception {
        UUID user = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email) VALUES (?, ?), (?, ?)",
                user, user + "@example.test", other, other + "@example.test");
        plans.createPersonalOrganization(user);
        plans.createPersonalOrganization(other);
        String token = "c".repeat(64);
        String code = legacyTag("Conta privada", "https://example.com", token);
        tags.claimPublishedTags(user, List.of(new TagService.TagClaim(code, token)));

        mvc.perform(get("/api/account/tags")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/account/tags").session(session(user)))
                .andExpect(status().isOk()).andExpect(content().string(org.hamcrest.Matchers.containsString("Conta privada")));
        mvc.perform(get("/api/account/tags").session(session(other)))
                .andExpect(status().isOk()).andExpect(content().json("[]"));
    }

    private String legacyTag(String name, String destination, String token) {
        String code = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                java.nio.ByteBuffer.allocate(18).putLong(UUID.randomUUID().getMostSignificantBits())
                        .putLong(UUID.randomUUID().getLeastSignificantBits()).putShort((short) 1).array());
        String hash;
        try {
            hash = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(java.nio.charset.StandardCharsets.US_ASCII)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
        UUID tagId = jdbc.queryForObject("""
                INSERT INTO nfc_tags (organization_id, public_code, label, management_token_hash, sale_price)
                VALUES ('00000000-0000-0000-0000-000000000001', ?, ?, ?, 49.90) RETURNING id
                """, UUID.class, code, name, hash);
        jdbc.update("INSERT INTO redirect_links (nfc_tag_id, target_url) VALUES (?, ?)", tagId, destination);
        return code;
    }

    private MockHttpSession session(UUID userId) {
        var context = SecurityContextHolder.createEmptyContext();
        var user = new CurrentUser(userId, userId + "@example.test", "Teste", null);
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user, null, List.of()));
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        return session;
    }
}
