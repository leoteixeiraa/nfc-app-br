package br.com.nfcapp.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

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
import org.springframework.http.MediaType;
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
import com.fasterxml.jackson.databind.ObjectMapper;

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
    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void anonymousPublicationCanBeRetriedManagedAndClaimed() throws Exception {
        String token = "a".repeat(64);
        String key = UUID.randomUUID().toString();
        String destination = "https://www.google.com/maps/place/example";
        var request = new TagService.TagRequest("Loja", "google-review", destination,
                null, null, null, "Loja", token, new BigDecimal("100"));
        String body = objectMapper.writeValueAsString(request);
        var csrfResult = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        String csrf = objectMapper.readTree(csrfResult.getResponse().getContentAsString()).get("token").asText();
        var session = (MockHttpSession) csrfResult.getRequest().getSession(false);

        var result = mvc.perform(post("/api/tags").session(session)
                .header("X-CSRF-TOKEN", csrf).header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.type").value("google-review"))
                .andExpect(jsonPath("$.salePrice").value(100))
                .andReturn();
        String code = objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
        assertNull(jdbc.queryForObject("SELECT owner_user_id FROM nfc_tags WHERE public_code = ?", UUID.class, code));
        mvc.perform(post("/api/tags").session(session)
                .header("X-CSRF-TOKEN", csrf).header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(code));

        String wrongBody = objectMapper.writeValueAsString(new TagService.TagRequest("Loja", "google-review",
                destination, null, null, null, "Loja", "b".repeat(64), new BigDecimal("100")));
        mvc.perform(post("/api/tags").session(session)
                .header("X-CSRF-TOKEN", csrf).header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON).content(wrongBody))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/tags/" + code).session(session)
                .header("X-CSRF-TOKEN", csrf).header("X-Tag-Management-Token", "b".repeat(64))
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/tags/" + code).session(session)
                .header("X-CSRF-TOKEN", csrf).header("X-Tag-Management-Token", token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(code));
        mvc.perform(get("/t/" + code)).andExpect(status().isFound())
                .andExpect(header().string("Location", destination));

        UUID user = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email) VALUES (?, ?)", user, user + "@example.test");
        plans.createPersonalOrganization(user);
        tags.claimPublishedTags(user, List.of(new TagService.TagClaim(code, token)));
        assertEquals(1, plans.currentPlan(user).publishedTags());
        assertEquals(code, tags.listForAccount(user).getFirst().id());
        mvc.perform(post("/api/tags").session(session)
                .header("X-CSRF-TOKEN", csrf).header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/tags/" + code).session(session)
                .header("X-CSRF-TOKEN", csrf).header("X-Tag-Management-Token", token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNotFound());
    }

    @Test
    void anonymousPublicationsDoNotShareTheFreePlanLimitButClaimsCountForTheAccount() {
        UUID user = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email) VALUES (?, ?)", user, user + "@example.test");
        plans.createPersonalOrganization(user);
        String token = "c".repeat(64);
        var claims = new ArrayList<TagService.TagClaim>();
        for (int i = 0; i < 4; i++) {
            var tag = tags.create(null, request("Placa " + i, "https://example.com", token),
                    UUID.randomUUID().toString());
            claims.add(new TagService.TagClaim(tag.id(), token));
        }

        assertEquals(0, plans.currentPlan(user).publishedTags());
        assertEquals(4, tags.claimPublishedTags(user, claims).size());
        assertEquals(4, plans.currentPlan(user).publishedTags());
        assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
                () -> tags.create(user, request("Nova", "https://example.com", token),
                        UUID.randomUUID().toString())).getStatusCode());
    }

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
    void updatingDestinationKeepsPublicIdentityAndDuplicateGetsANewIdentity() throws Exception {
        UUID user = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email) VALUES (?, ?)", user, user + "@example.test");
        plans.createPersonalOrganization(user);
        String originalToken = "d".repeat(64);
        var original = tags.create(user,
                request("Cafeteria", "https://example.com/maps", originalToken),
                UUID.randomUUID().toString());
        String permanentUrl = original.publicUrl();
        String originalQr = original.qrCodeDataUri();

        var updated = tags.update(user, original.id(),
                request("Cafeteria atualizada", "https://wa.me/5511999999999", originalToken),
                originalToken);

        assertEquals(original.id(), updated.id());
        assertEquals(permanentUrl, updated.publicUrl());
        assertEquals(originalQr, updated.qrCodeDataUri());
        assertEquals("https://wa.me/5511999999999", tags.findPublicDestination(original.id()).target());
        mvc.perform(get("/api/tags/public/" + original.id() + "/qr"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicUrl").value(permanentUrl));
        mvc.perform(get("/t/" + original.id()))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://wa.me/5511999999999"));

        String duplicateToken = "e".repeat(64);
        var duplicate = tags.create(user,
                request("Cafeteria (copia)", "https://wa.me/5511999999999", duplicateToken),
                UUID.randomUUID().toString());
        assertNotEquals(original.id(), duplicate.id());
        assertNotEquals(original.publicUrl(), duplicate.publicUrl());
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

    private TagService.TagRequest request(String name, String destination, String token) {
        return new TagService.TagRequest(name, "url", destination, null, null, null, null, token, null);
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
