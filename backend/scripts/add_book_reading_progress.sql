-- Apply once to an existing PostgreSQL database.
CREATE TABLE IF NOT EXISTS book_reading_progress (
    id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'reading',
    pages_read INTEGER NOT NULL DEFAULT -1,
    chapters_read DOUBLE PRECISION NOT NULL DEFAULT -1,
    volume INTEGER NOT NULL DEFAULT -1,
    date_started DATE NOT NULL DEFAULT CURRENT_DATE,
    date_finished DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT unique_book_reader_progress UNIQUE (book_id, user_id),
    CONSTRAINT book_reading_progress_pages_check CHECK (pages_read >= -1),
    CONSTRAINT book_reading_progress_chapters_check CHECK (chapters_read >= -1),
    CONSTRAINT book_reading_progress_volume_check CHECK (volume >= -1),
    CONSTRAINT book_reading_progress_status_check
        CHECK (status IN ('reading', 'completed', 'dropped'))
);

CREATE INDEX IF NOT EXISTS ix_book_reading_progress_book_id
    ON book_reading_progress (book_id);

CREATE INDEX IF NOT EXISTS ix_book_reading_progress_user_id
    ON book_reading_progress (user_id);

CREATE INDEX IF NOT EXISTS ix_book_reading_progress_active
    ON book_reading_progress (book_id, status);
