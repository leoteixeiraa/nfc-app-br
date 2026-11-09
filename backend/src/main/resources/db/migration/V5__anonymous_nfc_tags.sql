INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'NFC.APP - placas anônimas')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE nfc_tags
    ADD COLUMN destination_type VARCHAR(24) NOT NULL DEFAULT 'url',
    ADD COLUMN destination_label VARCHAR(160),
    ADD COLUMN management_token_hash CHAR(64),
    ADD COLUMN idempotency_key VARCHAR(64),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE redirect_links
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN pix_key VARCHAR(77),
    ADD COLUMN pix_receiver_name VARCHAR(25),
    ADD COLUMN pix_city VARCHAR(15);

CREATE UNIQUE INDEX uq_nfc_tags_idempotency_key
    ON nfc_tags (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE nfc_tags
    ADD CONSTRAINT ck_nfc_tags_destination_type
        CHECK (destination_type IN ('google-review', 'whatsapp', 'pix', 'url')),
    ADD CONSTRAINT ck_nfc_tags_management_token_hash
        CHECK (management_token_hash IS NULL OR length(management_token_hash) = 64);
