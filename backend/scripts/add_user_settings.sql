CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    default_book_view VARCHAR(20) NOT NULL DEFAULT 'grid' CHECK (default_book_view IN ('grid', 'list')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_user_settings_user_id ON user_settings(user_id);
