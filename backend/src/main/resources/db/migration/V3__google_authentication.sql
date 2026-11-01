ALTER TABLE users
    ADD COLUMN google_subject VARCHAR(255),
    ADD COLUMN display_name VARCHAR(160),
    ADD COLUMN picture_url TEXT;

CREATE UNIQUE INDEX uq_users_google_subject
    ON users (google_subject)
    WHERE google_subject IS NOT NULL;
