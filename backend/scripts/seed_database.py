"""Create repeatable local demo data from the pinned book catalog source.

The catalog is intentionally fetched in a bounded HTTP range instead of copying
the 119 MB source CSV into the application image. The revision is pinned, so
the first 100 records are stable and can be reproduced for the Week 13 MLOps
exercise.
"""

import csv
import io
import logging
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.auth import get_password_hash
from app.database import Base, SessionLocal, engine
from app.models import (
    Book,
    BookStatus,
    BookVisibility,
    PublicationStatus,
    ReadingHistory,
    Review,
    User,
)


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_PASSWORD = "admin1111"

CATALOG_DATASET = "nice-bill/book-recommender-artifacts"
CATALOG_REVISION = "e77f106e47c4430d0acdeef23b1cb096b31812a1"
CATALOG_URL = (
    "https://huggingface.co/datasets/"
    f"{CATALOG_DATASET}/resolve/{CATALOG_REVISION}/books_catalog.csv"
)
CATALOG_ROW_COUNT = 100
CATALOG_MAX_BYTES = 5 * 1024 * 1024

USER_SEEDS = [
    {"username": "admin", "email": "admin@gmail.com"},
    {"username": "user1", "email": "user1@gmail.com"},
    {"username": "user2", "email": "user2@gmail.com"},
]

STATUS_CYCLE = (
    BookStatus.COMPLETED,
    BookStatus.READING,
    BookStatus.WANT_TO_READ,
)


def apply_schema_updates(db: Session) -> None:
    """Apply idempotent migrations required by the demo relationships."""
    for migration_name in (
        "add_book_visibility.sql",
        "add_reading_history.sql",
        "add_reading_progress_fields.sql",
        "add_book_reading_progress.sql",
        "add_user_settings.sql",
        "add_admin_resources.sql",
    ):
        migration_path = Path(__file__).with_name(migration_name)
        db.connection().exec_driver_sql(migration_path.read_text(encoding="utf-8"))


def split_metadata(value: Optional[str]) -> List[str]:
    """Turn the catalog's comma-separated values into a compact tag list."""
    if not value:
        return []

    return [
        item.strip()
        for item in value.split(",")
        if item.strip() and item.strip() != "..."
    ]


def parse_source_rating(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def load_catalog_rows() -> List[dict]:
    """Load exactly 100 rows from the immutable Hugging Face CSV revision."""
    request = Request(
        CATALOG_URL,
        headers={
            "Range": f"bytes=0-{CATALOG_MAX_BYTES - 1}",
            "User-Agent": "philobiblus-demo-seed/1.0",
        },
    )

    logger.info("Fetching %s seed books from %s", CATALOG_ROW_COUNT, CATALOG_DATASET)
    with urlopen(request, timeout=30) as response:
        text_stream = io.TextIOWrapper(response, encoding="utf-8", newline="")
        reader = csv.DictReader(text_stream)
        rows = []
        for row in reader:
            if not row.get("title") or not row.get("authors"):
                continue
            rows.append(row)
            if len(rows) == CATALOG_ROW_COUNT:
                break

    if len(rows) != CATALOG_ROW_COUNT:
        raise RuntimeError(
            "The catalog response did not contain the required "
            f"{CATALOG_ROW_COUNT} complete rows; database changes were not committed."
        )
    return rows


def build_book_seed(row: dict, index: int, owner_username: str) -> dict:
    """Map catalog metadata to the public metadata fields of ``Book``."""
    genres = split_metadata(row.get("genres"))
    tags = list(dict.fromkeys(genres + split_metadata(row.get("tags"))))[:8]
    genre = genres[0] if genres else "Uncategorized"
    source_rating = parse_source_rating(row.get("rating"))
    status = STATUS_CYCLE[index % len(STATUS_CYCLE)]
    started_on = date(2026, 8, 1) + timedelta(days=index % 21)
    finished_on = started_on + timedelta(days=7 + index % 14)

    return {
        "owner": owner_username,
        "title": row["title"].strip(),
        "author": row["authors"].strip(),
        "genre": genre,
        "tags": tags or ["Uncategorized"],
        "visibility": BookVisibility.PUBLIC,
        "publication_status": PublicationStatus.COMPLETED,
        "status": status,
        # This is a rounded public catalog score for fixture purposes, not a
        # rating made by the Philobiblus owner.
        "rating": (
            min(5, max(1, round(source_rating)))
            if source_rating and source_rating > 0
            else None
        ),
        "volume": -1,
        "pages_total": -1,
        "pages_read": -1,
        "date_started": started_on if status != BookStatus.WANT_TO_READ else None,
        "date_finished": finished_on if status == BookStatus.COMPLETED else None,
        "notes": (
            f"Demo catalog fixture from {CATALOG_DATASET}@{CATALOG_REVISION}; "
            f"source rating: {source_rating:.2f}"
            if source_rating is not None
            else f"Demo catalog fixture from {CATALOG_DATASET}@{CATALOG_REVISION}."
        ),
        "cover_url": (row.get("cover_image_url") or "").strip() or None,
    }


def build_book_values(book_data: dict, owner: User) -> dict:
    """Fill every persisted Book field with catalog or deterministic fixture data."""
    pages_read = book_data.get("pages_read", -1)
    chapters_read = book_data.get("chapters_read")
    if chapters_read is None:
        chapters_read = round(pages_read / 35, 1) if pages_read >= 0 else -1.0

    return {
        "user_id": owner.id,
        "title": book_data["title"],
        "author": book_data["author"],
        "genre": book_data["genre"],
        "tags": book_data["tags"],
        "visibility": book_data["visibility"],
        "share_token": None,
        "publication_status": book_data["publication_status"],
        "status": book_data["status"],
        "rating": book_data["rating"],
        "volume": book_data["volume"],
        "pages_total": book_data["pages_total"],
        "pages_read": pages_read,
        "chapters_read": chapters_read,
        "date_started": book_data["date_started"],
        "date_finished": book_data["date_finished"],
        "notes": book_data["notes"],
        "cover_url": book_data["cover_url"],
    }


def get_or_create_user(db: Session, username: str, email: str) -> User:
    """Create a fixture user without overwriting existing credentials."""
    user = db.query(User).filter(User.username == username).first()
    if user:
        logger.info("Using existing seed user: %s", username)
        return user

    user = User(
        username=username,
        email=email,
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        is_active=True,
        is_admin=username == "admin",
    )
    db.add(user)
    db.flush()
    logger.info("Created seed user: %s", username)
    return user


def get_seed_users(db: Session) -> Dict[str, User]:
    users = {}
    for user_data in USER_SEEDS:
        user = get_or_create_user(db, **user_data)
        users[user.username] = user
    return users


def upsert_book(db: Session, book_data: dict, users: Dict[str, User]) -> Book:
    """Create or update by the deterministic owner/title/author fixture key."""
    owner = users[book_data["owner"]]
    book = (
        db.query(Book)
        .filter(
            Book.user_id == owner.id,
            Book.title == book_data["title"],
            Book.author == book_data["author"],
        )
        .first()
    )
    values = build_book_values(book_data, owner)
    if book:
        for field, value in values.items():
            setattr(book, field, value)
        return book

    book = Book(**values)
    db.add(book)
    return book


def seed_books(
    db: Session, users: Dict[str, User], catalog_rows: Iterable[dict]
) -> List[Book]:
    usernames = tuple(users)
    books = []
    for index, row in enumerate(catalog_rows):
        seed = build_book_seed(row, index, usernames[index % len(usernames)])
        books.append(upsert_book(db, seed, users))
    db.flush()
    return books


def seed_related_records(
    db: Session, books: List[Book], users: Dict[str, User]
) -> tuple[int, int]:
    """Add deterministic review and reading-history fixtures without duplicates."""
    reviewers = tuple(users.values())
    reviews_created = 0
    history_created = 0

    for index, book in enumerate(books):
        reviewer = reviewers[(index + 1) % len(reviewers)]
        existing_review = (
            db.query(Review)
            .filter(Review.book_id == book.id, Review.user_id == reviewer.id)
            .first()
        )
        if not existing_review:
            db.add(
                Review(
                    book_id=book.id,
                    user_id=reviewer.id,
                    rating=book.rating or 3,
                    comment=(
                        "Generated review fixture for the recommendation and social-flow demo."
                    ),
                )
            )
            reviews_created += 1

        if book.status == BookStatus.WANT_TO_READ:
            continue

        read_on = date(2026, 9, 1) + timedelta(days=index % 7)
        existing_history = (
            db.query(ReadingHistory)
            .filter(
                ReadingHistory.book_id == book.id,
                ReadingHistory.user_id == book.user_id,
                ReadingHistory.read_on == read_on,
            )
            .first()
        )
        if not existing_history:
            db.add(
                ReadingHistory(
                    book_id=book.id,
                    user_id=book.user_id,
                    read_on=read_on,
                    pages_read=-1,
                    chapters_read=-1.0,
                    volume=-1,
                    note="Generated catalog-fixture reading event.",
                )
            )
            history_created += 1

    return reviews_created, history_created


def seed_database() -> None:
    """Seed users, 100 public catalog books, reviews, and reading history."""
    catalog_rows = load_catalog_rows()
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        apply_schema_updates(db)
        users = get_seed_users(db)
        books = seed_books(db, users, catalog_rows)
        reviews_created, history_created = seed_related_records(db, books, users)
        db.commit()
        logger.info(
            "Seed completed: %s catalog books, %s new reviews, %s new reading-history rows.",
            len(books),
            reviews_created,
            history_created,
        )
    except Exception:
        db.rollback()
        logger.exception("Seed failed. Rolled back database changes.")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
