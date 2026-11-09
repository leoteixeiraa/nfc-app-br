package br.com.nfcapp.plans;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PlanService {
    private final JdbcTemplate jdbc;

    public PlanService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void createPersonalOrganization(UUID userId) {
        UUID organizationId = jdbc.queryForObject(
                "INSERT INTO organizations (name) VALUES (?) RETURNING id",
                UUID.class, "Organização pessoal");
        jdbc.update("INSERT INTO organization_memberships (organization_id, user_id) VALUES (?, ?)",
                organizationId, userId);
        int inserted = jdbc.update("""
                INSERT INTO organization_subscriptions (organization_id, plan_id, status)
                SELECT ?, id, 'ACTIVE' FROM plans WHERE code = 'FREE' AND active
                """, organizationId);
        if (inserted != 1) {
            throw new IllegalStateException("Plano FREE ativo não encontrado.");
        }
    }

    public UUID currentOrganization(UUID userId) {
        List<UUID> ids = jdbc.query("""
                SELECT organization_id FROM organization_memberships
                WHERE user_id = ? ORDER BY created_at, organization_id LIMIT 1
                """, (rs, row) -> rs.getObject(1, UUID.class), userId);
        if (ids.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organização não encontrada.");
        }
        return ids.getFirst();
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void lockOrganization(UUID organizationId) {
        jdbc.queryForObject("SELECT id FROM organizations WHERE id = ? FOR UPDATE", UUID.class, organizationId);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void validatePublication(UUID organizationId) {
        lockOrganization(organizationId);
        CurrentPlan plan = currentPlanForOrganization(organizationId);
        if (!"ACTIVE".equals(plan.status())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Assinatura não está ativa.");
        }
        if (plan.expiresAt() != null && !plan.expiresAt().isAfter(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Assinatura vencida.");
        }
        Feature feature = plan.features().stream()
                .filter(item -> item.code().equals("PUBLISHED_TAGS") && item.enabled())
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Publicação indisponível no plano."));
        if (feature.limit() != null && plan.publishedTags() >= feature.limit()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Limite de placas publicadas atingido.");
        }
    }

    public List<Plan> availablePlans() {
        return jdbc.query("""
                SELECT id, code, name, price, billing_period FROM plans WHERE active ORDER BY price, code
                """, (rs, row) -> new Plan(rs.getString("code"), rs.getString("name"),
                rs.getBigDecimal("price"), rs.getString("billing_period"),
                features(rs.getObject("id", UUID.class))));
    }

    public CurrentPlan currentPlan(UUID userId) {
        return currentPlanForOrganization(currentOrganization(userId));
    }

    public boolean featureEnabled(UUID organizationId, String featureCode) {
        CurrentPlan plan = currentPlanForOrganization(organizationId);
        return (plan.expiresAt() == null || plan.expiresAt().isAfter(Instant.now()))
                && plan.features().stream().anyMatch(feature -> feature.code().equals(featureCode) && feature.enabled());
    }

    @Transactional
    public void changePlan(UUID organizationId, String planCode) {
        lockOrganization(organizationId);
        List<UUID> planIds = jdbc.query("SELECT id FROM plans WHERE code = ? AND active",
                (rs, row) -> rs.getObject(1, UUID.class), planCode);
        if (planIds.isEmpty()) {
            throw new IllegalArgumentException("Plano ativo não encontrado.");
        }
        jdbc.update("""
                UPDATE organization_subscriptions SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
                WHERE organization_id = ? AND status = 'ACTIVE'
                """, organizationId);
        jdbc.update("""
                INSERT INTO organization_subscriptions (organization_id, plan_id, status)
                VALUES (?, ?, 'ACTIVE')
                """, organizationId, planIds.getFirst());
    }

    @Transactional
    public void cancelSubscription(UUID organizationId) {
        lockOrganization(organizationId);
        int updated = jdbc.update("""
                UPDATE organization_subscriptions SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
                WHERE organization_id = ? AND status = 'ACTIVE'
                """, organizationId);
        if (updated != 1) {
            throw new IllegalStateException("Assinatura ativa não encontrada.");
        }
    }

    private CurrentPlan currentPlanForOrganization(UUID organizationId) {
        List<CurrentPlan> plans = jdbc.query("""
                SELECT p.id, p.code, p.name, p.billing_period, s.status, s.started_at, s.expires_at,
                    (SELECT count(*) FROM nfc_tags t
                     WHERE t.organization_id = s.organization_id
                       AND EXISTS (SELECT 1 FROM redirect_links l WHERE l.nfc_tag_id = t.id AND l.is_active)) AS consumption
                FROM organization_subscriptions s JOIN plans p ON p.id = s.plan_id
                WHERE s.organization_id = ?
                ORDER BY CASE WHEN s.status = 'ACTIVE' THEN 0 ELSE 1 END,
                         s.created_at DESC, s.id DESC
                LIMIT 1
                """, (rs, row) -> {
                    Instant expiresAt = rs.getTimestamp("expires_at") == null
                            ? null : rs.getTimestamp("expires_at").toInstant();
                    boolean unavailable = !"ACTIVE".equals(rs.getString("status"))
                            || expiresAt != null && !expiresAt.isAfter(Instant.now());
                    List<Feature> currentFeatures = features(rs.getObject("id", UUID.class)).stream()
                            .map(feature -> new Feature(feature.code(), feature.enabled() && !unavailable,
                                    feature.entitled(), feature.limit(),
                                    feature.enabled() && !unavailable && feature.limit() == null))
                            .toList();
                    return new CurrentPlan(rs.getString("code"), rs.getString("name"),
                            rs.getString("status"), rs.getTimestamp("started_at").toInstant(), expiresAt,
                            !"NONE".equals(rs.getString("billing_period")), currentFeatures, rs.getLong("consumption"));
                }, organizationId);
        if (plans.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Assinatura não encontrada.");
        }
        return plans.getFirst();
    }

    private List<Feature> features(UUID planId) {
        return jdbc.query("""
                SELECT feature_code, enabled, available, limit_value FROM plan_features
                WHERE plan_id = ? ORDER BY feature_code
                """, (rs, row) -> {
            boolean enabled = rs.getBoolean("enabled") && rs.getBoolean("available");
            Integer limit = rs.getObject("limit_value", Integer.class);
            return new Feature(rs.getString("feature_code"), enabled, rs.getBoolean("enabled"),
                    limit, enabled && limit == null);
        }, planId);
    }

    @JsonInclude(JsonInclude.Include.ALWAYS)
    public record Feature(String code, boolean enabled, boolean entitled, Integer limit, boolean unlimited) { }
    public record Plan(String code, String name, BigDecimal price, String billingPeriod, List<Feature> features) { }
    public record CurrentPlan(String code, String name, String status, Instant startedAt, Instant expiresAt,
                              boolean premium, List<Feature> features, long publishedTags) { }
}
