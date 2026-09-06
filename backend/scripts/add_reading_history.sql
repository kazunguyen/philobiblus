CREATE TABLE IF NOT EXISTS reading_history (
    id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    read_on DATE NOT NULL DEFAULT CURRENT_DATE,
    pages_read INTEGER NOT NULL DEFAULT -1 CHECK (pages_read >= -1),
    chapters_read DOUBLE PRECISION NOT NULL DEFAULT -1 CHECK (chapters_read >= -1),
    chapter VARCHAR(100),
    volume INTEGER NOT NULL DEFAULT -1 CHECK (volume >= -1),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_reading_history_book_id ON reading_history (book_id);

CREATE INDEX IF NOT EXISTS ix_reading_history_user_id ON reading_history (user_id);

CREATE INDEX IF NOT EXISTS ix_reading_history_read_on ON reading_history (read_on);
CREATE INDEX IF NOT EXISTS ix_reading_history_recorded_at ON reading_history (recorded_at);
