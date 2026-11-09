package br.com.nfcapp.plans;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import br.com.nfcapp.auth.CurrentUser;
import br.com.nfcapp.auth.FirebaseIdentity;
import br.com.nfcapp.auth.UserAccountService;
import br.com.nfcapp.tags.TagService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "NFCAPP_ACCOUNT_INTEGRATION_TEST", matches = "true")
@TestPropertySource(properties = "app.firebase.project-id=integration-test")
class PlansIntegrationTest {
    @Autowired private UserAccountService accounts;
    @Autowired private PlanService plans;
    @Autowired private TagService tags;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private MockMvc mvc;
    @Autowired private DataSource dataSource;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TransactionTemplate transactions;

    @Test
    void registrationAndLoginCreateOnlyOneFreeSubscription() {
        FirebaseIdentity identity = identity();
        CurrentUser user = accounts.saveAccount(identity);
        assertEquals(user.id(), accounts.saveAccount(identity).id());
        UUID organization = plans.currentOrganization(user.id());
        assertEquals("FREE", plans.currentPlan(user.id()).code());
        assertEquals("ACTIVE", plans.currentPlan(user.id()).status());
        assertEquals(1, jdbc.queryForObject(
                "SELECT count(*) FROM organization_subscriptions WHERE organization_id = ?", Integer.class, organization));
        assertEquals(1, jdbc.queryForObject(
                "SELECT count(*) FROM organization_memberships WHERE user_id = ?", Integer.class, user.id()));
    }

    @Test
    void registrationRollsBackWhenFreePlanIsUnavailable() {
        FirebaseIdentity identity = identity();
        assertThrows(IllegalStateException.class, () -> transactions.executeWithoutResult(status -> {
            jdbc.update("UPDATE plans SET active = FALSE WHERE code = 'FREE'");
            accounts.saveAccount(identity);
        }));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM users WHERE firebase_uid = ?",
                Integer.class, identity.uid()));
        assertEquals(Boolean.TRUE, jdbc.queryForObject("SELECT active FROM plans WHERE code = 'FREE'", Boolean.class));
    }

    @Test
    void cancelledSubscriptionRemainsVisibleButCannotPublish() {
        CurrentUser user = accounts.saveAccount(identity());
        UUID organization = plans.currentOrganization(user.id());
        plans.cancelSubscription(organization);
        assertEquals("CANCELLED", plans.currentPlan(user.id()).status());
        assertFalse(plans.featureEnabled(organization, "PUBLISHED_TAGS"));
        assertEquals(403, assertThrows(ResponseStatusException.class,
                () -> tags.create(user.id(), request("f"), UUID.randomUUID().toString())).getStatusCode().value());
    }

    @Test
    void endpointsAndFeaturesAreIsolatedAndDoNotEnableFutureCapabilities() throws Exception {
        CurrentUser first = accounts.saveAccount(identity());
        CurrentUser second = accounts.saveAccount(identity());
        UUID firstOrg = plans.currentOrganization(first.id());
        plans.changePlan(firstOrg, "PRO");
        tags.create(first.id(), request("a"), UUID.randomUUID().toString());
        assertTrue(plans.featureEnabled(firstOrg, "PUBLISHED_TAGS"));
        assertFalse(plans.featureEnabled(firstOrg, "AI_SUGGESTIONS"));
        assertTrue(plans.currentPlan(first.id()).features().stream()
                .anyMatch(f -> f.code().equals("AI_SUGGESTIONS") && f.entitled() && !f.enabled()));
        String catalogBody = mvc.perform(get("/api/plans")).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString();
        JsonNode catalog = objectMapper.readTree(catalogBody);
        assertEquals("FREE", catalog.get(0).get("code").asText());
        assertEquals("PRO", catalog.get(1).get("code").asText());
        JsonNode freeTags = feature(catalog.get(0), "PUBLISHED_TAGS");
        assertEquals(3, freeTags.get("limit").asInt());
        assertFalse(freeTags.get("unlimited").asBoolean());
        JsonNode proTags = feature(catalog.get(1), "PUBLISHED_TAGS");
        assertTrue(proTags.has("limit"));
        assertTrue(proTags.get("limit").isNull());
        assertTrue(proTags.get("unlimited").asBoolean());
        mvc.perform(get("/api/organizations/current/plan")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/organizations/current/plan").session(session(first)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value("PRO"))
                .andExpect(jsonPath("$.publishedTags").value(1));
        mvc.perform(get("/api/organizations/current/plan").session(session(second)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value("FREE"))
                .andExpect(jsonPath("$.publishedTags").value(0));
    }

    @Test
    void anonymousPublicationIsRejectedEvenWithCsrfToken() throws Exception {
        var csrf = mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        String token = objectMapper.readTree(csrf.getResponse().getContentAsString()).get("token").asText();
        mvc.perform(post("/api/tags").session((MockHttpSession) csrf.getRequest().getSession(false))
                .header("X-CSRF-TOKEN", token).header("Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void limitAllowsEditingAndDowngradePreservesExistingRedirects() {
        CurrentUser user = accounts.saveAccount(identity());
        UUID organization = plans.currentOrganization(user.id());
        plans.changePlan(organization, "PRO");
        var created = java.util.stream.IntStream.range(0, 4)
                .mapToObj(i -> tags.create(user.id(), request("b"), UUID.randomUUID().toString())).toList();
        plans.changePlan(organization, "FREE");
        assertEquals(4, plans.currentPlan(user.id()).publishedTags());
        assertEquals("https://example.com", tags.findPublicDestination(created.getFirst().id()).target());
        tags.updateForAccount(user.id(), created.getFirst().id(), request("b"));
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> tags.create(user.id(), request("b"), UUID.randomUUID().toString())).getStatusCode().value());
        tags.deactivateForAccount(user.id(), created.get(0).id());
        tags.deactivateForAccount(user.id(), created.get(1).id());
        assertEquals(2, plans.currentPlan(user.id()).publishedTags());
        tags.create(user.id(), request("b"), UUID.randomUUID().toString());
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> tags.updateForAccount(user.id(), created.get(0).id(), request("b"))).getStatusCode().value());
    }

    @Test
    void freeAllowsThreePublishedTagsAndRejectsTheFourth() {
        CurrentUser user = accounts.saveAccount(identity());
        tags.create(user.id(), request("d"), UUID.randomUUID().toString());
        tags.create(user.id(), request("d"), UUID.randomUUID().toString());
        String key = UUID.randomUUID().toString();
        var third = tags.create(user.id(), request("d"), key);
        assertEquals(third.id(), tags.create(user.id(), request("d"), key).id());
        assertEquals(3, plans.currentPlan(user.id()).publishedTags());
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> tags.create(user.id(), request("d"), UUID.randomUUID().toString())).getStatusCode().value());
    }

    @Test
    void proAllowsMoreThanOneHundredPublishedTagsWithoutANumericLimit() {
        CurrentUser user = accounts.saveAccount(identity());
        UUID organization = plans.currentOrganization(user.id());
        plans.changePlan(organization, "PRO");
        jdbc.update("""
                WITH inserted AS (
                    INSERT INTO nfc_tags (organization_id, owner_user_id, public_code)
                    SELECT ?, ?, gen_random_uuid()::text FROM generate_series(1, 100)
                    RETURNING id
                )
                INSERT INTO redirect_links (nfc_tag_id, target_url)
                SELECT id, 'https://example.com' FROM inserted
                """, organization, user.id());
        tags.create(user.id(), request("e"), UUID.randomUUID().toString());
        assertEquals(101, plans.currentPlan(user.id()).publishedTags());
        tags.create(user.id(), request("e"), UUID.randomUUID().toString());
        assertEquals(102, plans.currentPlan(user.id()).publishedTags());
        assertTrue(plans.availablePlans().stream().filter(plan -> plan.code().equals("PRO"))
                .flatMap(plan -> plan.features().stream())
                .anyMatch(feature -> feature.code().equals("PUBLISHED_TAGS")
                        && feature.enabled() && feature.limit() == null && feature.unlimited()));
    }

    @Test
    void concurrentPublicationsCannotExceedLimit() throws Exception {
        CurrentUser user = accounts.saveAccount(identity());
        tags.create(user.id(), request("c"), UUID.randomUUID().toString());
        tags.create(user.id(), request("c"), UUID.randomUUID().toString());
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var tasks = java.util.stream.IntStream.range(0, 2).mapToObj(i -> pool.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Timeout");
                try {
                    tags.create(user.id(), request("c"), UUID.randomUUID().toString());
                    return 201;
                } catch (ResponseStatusException e) {
                    return e.getStatusCode().value();
                }
            })).toList();
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            assertEquals(List.of(201, 409), tasks.stream().map(task -> {
                try { return task.get(20, TimeUnit.SECONDS); }
                catch (Exception e) { throw new IllegalStateException(e); }
            }).sorted().toList());
        }
        assertEquals(3, plans.currentPlan(user.id()).publishedTags());
    }

    @Test
    void migrationBackfillsExistingUsersAndOrganizationsAndIsRepeatable() {
        String schema = "test_" + UUID.randomUUID().toString().replace("-", "");
        Flyway old = Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").target("7").load();
        old.migrate();
        UUID user = UUID.randomUUID();
        UUID org = UUID.randomUUID();
        jdbc.update("INSERT INTO " + schema + ".users (id, email) VALUES (?, ?)", user, user + "@example.test");
        jdbc.update("INSERT INTO " + schema + ".organizations (id, name) VALUES (?, ?)", org, "Existente");
        UUID tag = UUID.randomUUID();
        jdbc.update("INSERT INTO " + schema + ".nfc_tags (id, organization_id, public_code, owner_user_id)"
                + " VALUES (?, '00000000-0000-0000-0000-000000000001', ?, ?)", tag, "legacy-code", user);
        jdbc.update("INSERT INTO " + schema + ".redirect_links (nfc_tag_id, target_url) VALUES (?, ?)",
                tag, "https://example.com");
        Flyway latest = Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").load();
        assertEquals(2, latest.migrate().migrationsExecuted);
        assertEquals(0, latest.migrate().migrationsExecuted);
        assertNull(jdbc.queryForObject("SELECT limit_value FROM " + schema + ".plan_features pf"
                + " JOIN " + schema + ".plans p ON p.id = pf.plan_id"
                + " WHERE p.code = 'PRO' AND pf.feature_code = 'PUBLISHED_TAGS'", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM " + schema
                + ".organization_memberships WHERE user_id = ?", Integer.class, user));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM " + schema
                + ".organization_subscriptions WHERE organization_id = ? AND status = 'ACTIVE'", Integer.class, org));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM " + schema
                + ".organizations o WHERE NOT EXISTS (SELECT 1 FROM " + schema
                + ".organization_subscriptions s WHERE s.organization_id = o.id AND s.status = 'ACTIVE')", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM " + schema + ".nfc_tags t JOIN "
                + schema + ".organization_memberships m ON m.organization_id = t.organization_id"
                + " JOIN " + schema + ".redirect_links l ON l.nfc_tag_id = t.id"
                + " WHERE t.id = ? AND m.user_id = ? AND l.is_active AND l.target_url = ?",
                Integer.class, tag, user, "https://example.com"));
    }

    private FirebaseIdentity identity() {
        String id = UUID.randomUUID().toString();
        return new FirebaseIdentity(id, id + "@example.test", "Teste", null);
    }

    private JsonNode feature(JsonNode plan, String code) {
        for (JsonNode feature : plan.get("features")) {
            if (code.equals(feature.get("code").asText())) {
                return feature;
            }
        }
        throw new AssertionError("Recurso não encontrado no plano: " + code);
    }

    private TagService.TagRequest request(String tokenCharacter) {
        return new TagService.TagRequest("Placa", "url", "https://example.com",
                null, null, null, null, tokenCharacter.repeat(64), null);
    }

    private MockHttpSession session(CurrentUser user) {
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user, null, List.of()));
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        return session;
    }
}
