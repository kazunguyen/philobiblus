-- Apply once to an existing PostgreSQL database.
ALTER TABLE books
    ADD COLUMN IF NOT EXISTS chapters_read DOUBLE PRECISION NOT NULL DEFAULT -1;

ALTER TABLE books
    ADD COLUMN IF NOT EXISTS publication_status VARCHAR(20) NOT NULL DEFAULT 'ongoing';

ALTER TABLE reading_history
    ADD COLUMN IF NOT EXISTS chapters_read DOUBLE PRECISION;

ALTER TABLE reading_history
    ADD COLUMN IF NOT EXISTS date_started DATE;

ALTER TABLE reading_history
    ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) NOT NULL DEFAULT 'progress';

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

UPDATE reading_history
SET note = '__seed__'
WHERE note = 'Seeded from the book''s current reading progress.';

UPDATE reading_history
SET
    event_type = 'started',
    read_on = date_started
WHERE date_started IS NOT NULL
  AND note = '__seed__';

WITH first_history_entry AS (
    SELECT DISTINCT ON (book_id) id
    FROM reading_history
    WHERE date_started IS NOT NULL
    ORDER BY book_id, recorded_at ASC NULLS LAST, id ASC
)
UPDATE reading_history
SET
    event_type = 'started',
    read_on = date_started
WHERE id IN (SELECT id FROM first_history_entry);

ALTER TABLE reading_history
    ALTER COLUMN pages_read SET DEFAULT -1,
    ALTER COLUMN chapters_read SET DEFAULT -1,
    ALTER COLUMN volume SET DEFAULT -1;

ALTER TABLE reading_history
    ALTER COLUMN pages_read SET NOT NULL,
    ALTER COLUMN chapters_read SET NOT NULL,
    ALTER COLUMN volume SET NOT NULL;
