-- Apply once to an existing PostgreSQL database.
ALTER TABLE books
    ADD COLUMN IF NOT EXISTS chapters_read DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE books
    ADD COLUMN IF NOT EXISTS publication_status VARCHAR(20) NOT NULL DEFAULT 'ongoing';

ALTER TABLE reading_history
    ADD COLUMN IF NOT EXISTS chapters_read DOUBLE PRECISION;

ALTER TABLE reading_history
    ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE reading_history
    ALTER COLUMN read_on SET DEFAULT CURRENT_DATE;

UPDATE books
SET chapters_read = 0
WHERE chapters_read IS NULL;

UPDATE books
SET publication_status = 'ongoing'
WHERE publication_status IS NULL;

UPDATE reading_history
SET recorded_at = COALESCE(recorded_at, NOW())
WHERE recorded_at IS NULL;
