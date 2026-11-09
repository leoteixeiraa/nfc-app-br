CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    billing_period VARCHAR(16) NOT NULL CHECK (billing_period IN ('NONE', 'MONTHLY')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans (id),
    feature_code VARCHAR(64) NOT NULL,
    enabled BOOLEAN NOT NULL,
    available BOOLEAN NOT NULL,
    limit_value INTEGER CHECK (limit_value IS NULL OR limit_value >= 0),
    CONSTRAINT uq_plan_feature UNIQUE (plan_id, feature_code)
);

CREATE TABLE organization_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations (id),
    plan_id UUID NOT NULL REFERENCES plans (id),
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (expires_at IS NULL OR expires_at >= started_at)
);

CREATE UNIQUE INDEX uq_organization_subscription_current
    ON organization_subscriptions (organization_id) WHERE status = 'ACTIVE';
CREATE INDEX ix_organization_subscriptions_history
    ON organization_subscriptions (organization_id, created_at DESC);
CREATE INDEX ix_nfc_tags_organization_published
    ON nfc_tags (organization_id, id);

INSERT INTO plans (code, name, price, billing_period) VALUES
    ('FREE', 'Start', 0, 'NONE'),
    ('PRO', 'Pro', 29.90, 'MONTHLY');

INSERT INTO plan_features (plan_id, feature_code, enabled, available, limit_value)
SELECT p.id, f.feature_code, (f.available OR p.code = 'PRO'), f.available,
       CASE WHEN f.feature_code = 'PUBLISHED_TAGS' THEN
           CASE p.code WHEN 'FREE' THEN 3 ELSE 100 END
       ELSE NULL END
FROM plans p
CROSS JOIN (VALUES
    ('PUBLISHED_TAGS', TRUE),
    ('CLIENTS', TRUE),
    ('NFC_QR', TRUE),
    ('DYNAMIC_LINKS', TRUE),
    ('BASIC_DASHBOARD', TRUE),
    ('SALES_DASHBOARD', FALSE),
    ('PDF_REPORTS', FALSE),
    ('ACCESS_STATISTICS', FALSE),
    ('GOOGLE_MAPS_PROSPECTING', FALSE),
    ('AI_SUGGESTIONS', FALSE)
) AS f(feature_code, available)
WHERE p.code IN ('FREE', 'PRO');

CREATE TEMPORARY TABLE new_personal_organizations (
    user_id UUID PRIMARY KEY,
    organization_id UUID NOT NULL
) ON COMMIT DROP;

INSERT INTO new_personal_organizations (user_id, organization_id)
SELECT u.id, gen_random_uuid()
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM organization_memberships m WHERE m.user_id = u.id);

INSERT INTO organizations (id, name)
SELECT organization_id, 'Organização pessoal'
FROM new_personal_organizations;

INSERT INTO organization_memberships (organization_id, user_id)
SELECT organization_id, user_id FROM new_personal_organizations;

INSERT INTO organization_subscriptions (organization_id, plan_id, status)
SELECT o.id, p.id, 'ACTIVE'
FROM organizations o CROSS JOIN plans p
WHERE p.code = 'FREE'
  AND NOT EXISTS (
      SELECT 1 FROM organization_subscriptions s
      WHERE s.organization_id = o.id AND s.status = 'ACTIVE'
  );

UPDATE nfc_tags t
SET organization_id = (
    SELECT m.organization_id FROM organization_memberships m
    WHERE m.user_id = t.owner_user_id
    ORDER BY m.created_at, m.organization_id LIMIT 1
)
WHERE t.owner_user_id IS NOT NULL
  AND t.organization_id = '00000000-0000-0000-0000-000000000001';
