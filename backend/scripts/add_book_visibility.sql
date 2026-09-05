-- Run once against an existing PostgreSQL database before deploying this feature.
ALTER TABLE books
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'public';

ALTER TABLE books
    ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS ix_books_share_token
    ON books (share_token)
    WHERE share_token IS NOT NULL;

UPDATE books
SET visibility = 'public'
WHERE visibility IS NULL;
