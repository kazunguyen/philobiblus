-- Apply once to existing PostgreSQL databases before enabling Admin View.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- The seeded administrator receives this role even when the account existed
-- before the role column was introduced.
UPDATE users
SET is_admin = TRUE
WHERE username = 'admin';

-- A book with active readers survives deletion of its original owner. The
-- application clears user_id on those records before deleting the user.
ALTER TABLE books
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE books
    DROP CONSTRAINT IF EXISTS books_user_id_fkey;

ALTER TABLE books
    ADD CONSTRAINT books_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
