-- Modelo inicial de organizações, vínculos, placas, destinos e eventos.
-- Sem tabelas de autenticação operacional ou regras de redirecionamento na API.

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_organizations_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TABLE organization_memberships (
    organization_id UUID NOT NULL REFERENCES organizations (id),
    user_id UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_organization_memberships PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX ix_organization_memberships_user_id
    ON organization_memberships (user_id);

CREATE TABLE nfc_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations (id),
    public_code VARCHAR(64) NOT NULL UNIQUE,
    label VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_nfc_tags_public_code_not_blank CHECK (length(btrim(public_code)) > 0)
);

CREATE INDEX ix_nfc_tags_organization_id ON nfc_tags (organization_id);

CREATE TABLE redirect_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nfc_tag_id UUID NOT NULL REFERENCES nfc_tags (id),
    target_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_redirect_links_id_tag UNIQUE (id, nfc_tag_id)
);

CREATE UNIQUE INDEX uq_redirect_links_one_active_per_tag
    ON redirect_links (nfc_tag_id)
    WHERE is_active;

CREATE INDEX ix_redirect_links_tag_created_at
    ON redirect_links (nfc_tag_id, created_at DESC);

CREATE TABLE access_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nfc_tag_id UUID NOT NULL,
    redirect_link_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_access_events_tag_link
        FOREIGN KEY (redirect_link_id, nfc_tag_id)
        REFERENCES redirect_links (id, nfc_tag_id)
);

CREATE INDEX ix_access_events_tag_occurred_at
    ON access_events (nfc_tag_id, occurred_at DESC);
