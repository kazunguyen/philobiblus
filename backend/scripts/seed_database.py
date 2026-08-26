import logging
from datetime import date
from typing import Dict, List

from sqlalchemy.orm import Session

from app.auth import get_password_hash
from app.database import Base, SessionLocal, engine
from app.models import Book, BookStatus, User


logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

DEFAULT_PASSWORD = "admin1111"

USER_SEEDS = [
    {"username": "admin", "email": "admin@gmail.com"},
    {"username": "user1", "email": "user1@gmail.com"},
    {"username": "user2", "email": "user2@gmail.com"},
]

BOOK_SEEDS = [
    {
        "owner": "admin",
        "title": "Clean Code",
        "author": "Robert C. Martin",
        "genre": "Software Engineering",
        "status": BookStatus.COMPLETED,
        "rating": 5,
        "volume": 1,
        "pages_total": 464,
        "pages_read": 464,
        "date_started": date(2026, 1, 5),
        "date_finished": date(2026, 1, 26),
        "notes": "Practical principles for writing maintainable code.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg",
    },
    {
        "owner": "admin",
        "title": "The Pragmatic Programmer",
        "author": "David Thomas and Andrew Hunt",
        "genre": "Software Engineering",
        "status": BookStatus.READING,
        "rating": 5,
        "volume": 1,
        "pages_total": 352,
        "pages_read": 210,
        "date_started": date(2026, 2, 2),
        "date_finished": None,
        "notes": "Useful engineering habits and career-level advice.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9780201616224-L.jpg",
    },
    {
        "owner": "admin",
        "title": "Designing Data-Intensive Applications",
        "author": "Martin Kleppmann",
        "genre": "Distributed Systems",
        "status": BookStatus.WANT_TO_READ,
        "rating": None,
        "volume": 1,
        "pages_total": 616,
        "pages_read": 0,
        "date_started": None,
        "date_finished": None,
        "notes": "Queued for database and distributed systems study.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9781449373320-L.jpg",
    },
    {
        "owner": "admin",
        "title": "Kubernetes in Action",
        "author": "Marko Luksa",
        "genre": "DevOps",
        "status": BookStatus.READING,
        "rating": 4,
        "volume": 1,
        "pages_total": 624,
        "pages_read": 180,
        "date_started": date(2026, 3, 10),
        "date_finished": None,
        "notes": "Reference material for Kubernetes deployment practice.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9781617293726-L.jpg",
    },
    {
        "owner": "admin",
        "title": "Site Reliability Engineering",
        "author": "Betsy Beyer",
        "genre": "DevOps",
        "status": BookStatus.WANT_TO_READ,
        "rating": None,
        "volume": 1,
        "pages_total": 552,
        "pages_read": 0,
        "date_started": None,
        "date_finished": None,
        "notes": "Planned reading for observability and reliability topics.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9781491929124-L.jpg",
    },
    {
        "owner": "user1",
        "title": "Atomic Habits",
        "author": "James Clear",
        "genre": "Self Improvement",
        "status": BookStatus.COMPLETED,
        "rating": 5,
        "volume": 1,
        "pages_total": 320,
        "pages_read": 320,
        "date_started": date(2026, 1, 12),
        "date_finished": date(2026, 1, 20),
        "notes": "Simple habit systems with practical examples.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
    },
    {
        "owner": "user1",
        "title": "Deep Work",
        "author": "Cal Newport",
        "genre": "Productivity",
        "status": BookStatus.READING,
        "rating": 4,
        "volume": 1,
        "pages_total": 304,
        "pages_read": 140,
        "date_started": date(2026, 2, 18),
        "date_finished": None,
        "notes": "Focused work methods for difficult technical tasks.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg",
    },
    {
        "owner": "user1",
        "title": "Dune",
        "author": "Frank Herbert",
        "genre": "Science Fiction",
        "status": BookStatus.COMPLETED,
        "rating": 5,
        "volume": 1,
        "pages_total": 688,
        "pages_read": 688,
        "date_started": date(2026, 3, 1),
        "date_finished": date(2026, 3, 25),
        "notes": "Expansive science fiction worldbuilding.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg",
    },
    {
        "owner": "user1",
        "title": "Project Hail Mary",
        "author": "Andy Weir",
        "genre": "Science Fiction",
        "status": BookStatus.READING,
        "rating": 4,
        "volume": 1,
        "pages_total": 496,
        "pages_read": 260,
        "date_started": date(2026, 4, 5),
        "date_finished": None,
        "notes": "Fast-paced science fiction with engineering problem solving.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9780593135204-L.jpg",
    },
    {
        "owner": "user1",
        "title": "The Hobbit",
        "author": "J. R. R. Tolkien",
        "genre": "Fantasy",
        "status": BookStatus.WANT_TO_READ,
        "rating": None,
        "volume": 1,
        "pages_total": 310,
        "pages_read": 0,
        "date_started": None,
        "date_finished": None,
        "notes": "Classic fantasy queued for later reading.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg",
    },
    {
        "owner": "user2",
        "title": "The Phoenix Project",
        "author": "Gene Kim",
        "genre": "DevOps",
        "status": BookStatus.COMPLETED,
        "rating": 4,
        "volume": 1,
        "pages_total": 432,
        "pages_read": 432,
        "date_started": date(2026, 1, 8),
        "date_finished": date(2026, 1, 30),
        "notes": "DevOps concepts explained through a business narrative.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9780988262591-L.jpg",
    },
    {
        "owner": "user2",
        "title": "The DevOps Handbook",
        "author": "Gene Kim",
        "genre": "DevOps",
        "status": BookStatus.READING,
        "rating": 4,
        "volume": 1,
        "pages_total": 480,
        "pages_read": 190,
        "date_started": date(2026, 2, 15),
        "date_finished": None,
        "notes": "Implementation patterns for delivery and operations.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9781942788003-L.jpg",
    },
    {
        "owner": "user2",
        "title": "Zero Trust",
        "author": "Evan Gilman and Doug Barth",
        "genre": "Security",
        "status": BookStatus.WANT_TO_READ,
        "rating": None,
        "volume": 1,
        "pages_total": 240,
        "pages_read": 0,
        "date_started": None,
        "date_finished": None,
        "notes": "Security architecture reference for least privilege design.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9781491962190-L.jpg",
    },
    {
        "owner": "user2",
        "title": "Learning SQL",
        "author": "Alan Beaulieu",
        "genre": "Database",
        "status": BookStatus.COMPLETED,
        "rating": 4,
        "volume": 1,
        "pages_total": 384,
        "pages_read": 384,
        "date_started": date(2026, 3, 3),
        "date_finished": date(2026, 3, 18),
        "notes": "SQL fundamentals and relational database practice.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9781492057611-L.jpg",
    },
    {
        "owner": "user2",
        "title": "The Art of Monitoring",
        "author": "James Turnbull",
        "genre": "Observability",
        "status": BookStatus.DROPPED,
        "rating": 3,
        "volume": 1,
        "pages_total": 598,
        "pages_read": 120,
        "date_started": date(2026, 4, 1),
        "date_finished": None,
        "notes": "Paused because current focus shifted to Kubernetes manifests.",
        "cover_url": "https://covers.openlibrary.org/b/isbn/9780988820241-L.jpg",
    },
]


def get_or_create_user(db: Session, username: str, email: str) -> User:
    """Return an existing user or create one with the seed password."""
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.email = email
        user.hashed_password = get_password_hash(DEFAULT_PASSWORD)
        user.is_active = True
        logger.info("Updated seed user: %s", username)
        return user

    user = User(
        username=username,
        email=email,
        hashed_password=get_password_hash(DEFAULT_PASSWORD),
        is_active=True,
    )
    db.add(user)
    db.flush()
    logger.info("Created seed user: %s", username)
    return user


def get_seed_users(db: Session) -> Dict[str, User]:
    """Create seed users and return them by username."""
    users = {}
    for user_data in USER_SEEDS:
        user = get_or_create_user(
            db=db,
            username=user_data["username"],
            email=user_data["email"],
        )
        users[user.username] = user
    return users


def upsert_book(db: Session, book_data: dict, users: Dict[str, User]) -> Book:
    """Create or update a seed book for its assigned owner."""
    owner_username = book_data["owner"]
    owner = users[owner_username]

    book = (
        db.query(Book)
        .filter(
            Book.user_id == owner.id,
            Book.title == book_data["title"],
            Book.author == book_data["author"],
        )
        .first()
    )

    book_values = {
        key: value
        for key, value in book_data.items()
        if key != "owner"
    }
    book_values["user_id"] = owner.id

    if book:
        for field, value in book_values.items():
            setattr(book, field, value)
        logger.info("Updated seed book: %s", book.title)
        return book

    book = Book(**book_values)
    db.add(book)
    logger.info("Created seed book: %s", book.title)
    return book


def seed_books(db: Session, users: Dict[str, User]) -> None:
    """Create or update all seed books."""
    for book_data in BOOK_SEEDS:
        upsert_book(db=db, book_data=book_data, users=users)


def seed_database() -> None:
    """Seed the database with sample users and books."""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        users = get_seed_users(db)
        seed_books(db=db, users=users)
        db.commit()
        logger.info(
            "Seed completed with %s users and %s books.",
            len(users),
            len(BOOK_SEEDS),
        )
    except Exception:
        db.rollback()
        logger.exception("Seed failed. Rolled back database changes.")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
