-- Apply once to an existing PostgreSQL database.
ALTER TABLE books
    ADD COLUMN IF NOT EXISTS chapters_read DOUBLE PRECISION NOT NULL DEFAULT -1;

ALTER TABLE books
    ADD COLUMN IF NOT EXISTS publication_status VARCHAR(20) NOT NULL DEFAULT 'ongoing';

ALTER TABLE reading_history
    ADD COLUMN IF NOT EXISTS chapters_read DOUBLE PRECISION;

ALTER TABLE reading_history
    ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE reading_history
    ALTER COLUMN read_on SET DEFAULT CURRENT_DATE;

ALTER TABLE reading_history
    DROP CONSTRAINT IF EXISTS reading_history_pages_read_check,
    DROP CONSTRAINT IF EXISTS reading_history_chapters_read_check,
    DROP CONSTRAINT IF EXISTS reading_history_volume_check;

ALTER TABLE books
    ALTER COLUMN volume SET DEFAULT -1,
    ALTER COLUMN pages_total SET DEFAULT -1,
    ALTER COLUMN pages_read SET DEFAULT -1,
    ALTER COLUMN chapters_read SET DEFAULT -1;

UPDATE books
SET
    volume = COALESCE(volume, -1),
    pages_total = COALESCE(pages_total, -1),
    pages_read = COALESCE(pages_read, -1),
    chapters_read = COALESCE(chapters_read, -1);

ALTER TABLE books
    ALTER COLUMN volume SET NOT NULL,
    ALTER COLUMN pages_total SET NOT NULL,
    ALTER COLUMN pages_read SET NOT NULL,
    ALTER COLUMN chapters_read SET NOT NULL;

UPDATE books
SET publication_status = 'ongoing'
WHERE publication_status IS NULL;

UPDATE reading_history
SET
    pages_read = COALESCE(pages_read, -1),
    chapters_read = COALESCE(chapters_read, -1),
    volume = COALESCE(volume, -1),
    recorded_at = COALESCE(recorded_at, NOW());

DELETE FROM reading_history
WHERE note IN ('__seed__', 'Seeded from the book''s current reading progress.');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'reading_history'
          AND column_name = 'event_type'
    ) THEN
        EXECUTE 'DELETE FROM reading_history WHERE event_type = ''started''';
    END IF;
END $$;

ALTER TABLE reading_history
    ALTER COLUMN pages_read SET DEFAULT -1,
    ALTER COLUMN chapters_read SET DEFAULT -1,
    ALTER COLUMN volume SET DEFAULT -1;

ALTER TABLE reading_history
    ALTER COLUMN pages_read SET NOT NULL,
    ALTER COLUMN chapters_read SET NOT NULL,
    ALTER COLUMN volume SET NOT NULL;
