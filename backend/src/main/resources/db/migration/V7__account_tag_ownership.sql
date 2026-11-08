ALTER TABLE nfc_tags
    ADD COLUMN owner_user_id UUID REFERENCES users (id);

CREATE INDEX ix_nfc_tags_owner_user_id
    ON nfc_tags (owner_user_id)
    WHERE owner_user_id IS NOT NULL;
