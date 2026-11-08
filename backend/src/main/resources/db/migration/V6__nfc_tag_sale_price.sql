ALTER TABLE nfc_tags
    ADD COLUMN sale_price NUMERIC(12,2) NULL;

ALTER TABLE nfc_tags
    ADD CONSTRAINT ck_nfc_tags_sale_price CHECK (sale_price IS NULL OR sale_price >= 0);
