ALTER TABLE users RENAME COLUMN google_subject TO firebase_uid;
ALTER INDEX uq_users_google_subject RENAME TO uq_users_firebase_uid;
