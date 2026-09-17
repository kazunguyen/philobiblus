"""Administrator-only resource management endpoints."""

from collections.abc import Iterable

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_admin, get_password_hash
from app.database import get_db
from app.models import (
    Book,
    BookReadingProgress,
    BookStatus,
    BookVisibility,
    Follow,
    Friendship,
    ReadingHistory,
    Review,
    User,
)
from app.schemas import (
    AdminBookDetailOut,
    AdminBookOut,
    AdminOverviewOut,
    AdminPasswordReset,
    AdminUserDeletionOut,
    AdminUserDetailOut,
    AdminUserOut,
    AdminUserStatusUpdate,
    ReadingHistoryOut,
    ReviewOut,
    UserPublicOut,
)

router = APIRouter(prefix="/api/admin", tags=["Administration"])


def _reader_counts(db: Session, book_ids: Iterable[int]) -> dict[int, int]:
    ids = list(book_ids)
    if not ids:
        return {}
    return dict(
        db.query(BookReadingProgress.book_id, func.count(BookReadingProgress.id))
        .filter(
            BookReadingProgress.book_id.in_(ids),
            BookReadingProgress.status == BookStatus.READING,
        )
        .group_by(BookReadingProgress.book_id)
        .all()
    )


def _book_out(book: Book, reader_count: int = 0) -> AdminBookOut:
    data = AdminBookOut.model_validate(book).model_dump()
    data["owner"] = (
        UserPublicOut.model_validate(book.owner).model_dump()
        if book.owner
        else None
    )
    owner_is_reading = book.status == BookStatus.READING or book.status == "reading"
    data["active_reader_count"] = reader_count + int(owner_is_reading)
    return AdminBookOut.model_validate(data)


def _user_out(user: User, book_count: int = 0) -> AdminUserOut:
    data = AdminUserOut.model_validate(user).model_dump()
    data["book_count"] = book_count
    return AdminUserOut.model_validate(data)


def _user_or_404(username: str, db: Session) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/overview", response_model=AdminOverviewOut)
def get_overview(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    visibility_counts = dict(
        db.query(Book.visibility, func.count(Book.id))
        .group_by(Book.visibility)
        .all()
    )
    return AdminOverviewOut(
        total_users=db.query(func.count(User.id)).scalar() or 0,
        active_users=(
            db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
        ),
        total_books=db.query(func.count(Book.id)).scalar() or 0,
        public_books=visibility_counts.get(BookVisibility.PUBLIC, 0),
        restricted_books=visibility_counts.get(BookVisibility.RESTRICTED, 0),
        private_books=visibility_counts.get(BookVisibility.PRIVATE, 0),
    )


@router.get("/books", response_model=list[AdminBookOut])
def list_books(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List every book, regardless of its visibility."""
    books = (
        db.query(Book)
        .options(joinedload(Book.owner))
        .order_by(Book.created_at.desc(), Book.id.desc())
        .all()
    )
    counts = _reader_counts(db, (book.id for book in books))
    return [_book_out(book, counts.get(book.id, 0)) for book in books]


@router.get("/books/{book_id}", response_model=AdminBookDetailOut)
def get_book_detail(
    book_id: int,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Read a full book record without exposing an admin mutation route."""
    book = (
        db.query(Book)
        .options(joinedload(Book.owner))
        .filter(Book.id == book_id)
        .first()
    )
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    reviews = (
        db.query(Review)
        .options(joinedload(Review.reviewer))
        .filter(Review.book_id == book.id)
        .order_by(Review.created_at.desc())
        .all()
    )
    reading_history = (
        db.query(ReadingHistory)
        .filter(ReadingHistory.book_id == book.id)
        .order_by(ReadingHistory.read_on.asc(), ReadingHistory.id.asc())
        .all()
    )
    reader_count = _reader_counts(db, [book.id]).get(book.id, 0)
    return AdminBookDetailOut(
        book=_book_out(book, reader_count),
        reviews=[ReviewOut.model_validate(review) for review in reviews],
        reading_history=[ReadingHistoryOut.model_validate(entry) for entry in reading_history],
    )


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(User, func.count(Book.id).label("book_count"))
        .outerjoin(Book, Book.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at.desc(), User.id.desc())
        .all()
    )
    return [_user_out(user, book_count) for user, book_count in rows]


@router.get("/users/{username}", response_model=AdminUserDetailOut)
def get_user_detail(
    username: str,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Read private account information and every owned book."""
    user = _user_or_404(username, db)
    books = (
        db.query(Book)
        .options(joinedload(Book.owner))
        .filter(Book.user_id == user.id)
        .order_by(Book.created_at.desc(), Book.id.desc())
        .all()
    )
    counts = _reader_counts(db, (book.id for book in books))
    return AdminUserDetailOut(
        user=_user_out(user, len(books)),
        books=[_book_out(book, counts.get(book.id, 0)) for book in books],
    )


@router.put("/users/{username}/password", response_model=AdminUserOut)
def reset_password(
    username: str,
    password_in: AdminPasswordReset,
    _: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = _user_or_404(username, db)
    user.hashed_password = get_password_hash(password_in.password)
    db.commit()
    db.refresh(user)
    return _user_out(
        user,
        db.query(func.count(Book.id)).filter(Book.user_id == user.id).scalar() or 0,
    )


@router.put("/users/{username}/status", response_model=AdminUserOut)
def set_account_status(
    username: str,
    status_in: AdminUserStatusUpdate,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = _user_or_404(username, db)
    if user.id == current_admin.id and not status_in.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot lock their own account",
        )
    user.is_active = status_in.is_active
    db.commit()
    db.refresh(user)
    return _user_out(
        user,
        db.query(func.count(Book.id)).filter(Book.user_id == user.id).scalar() or 0,
    )


@router.delete("/users/{username}", response_model=AdminUserDeletionOut)
def delete_user(
    username: str,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Delete account data while retaining books with another active reader."""
    user = _user_or_404(username, db)
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot delete their own account",
        )

    retained_book_ids = {
        book_id
        for (book_id,) in (
            db.query(Book.id)
            .join(BookReadingProgress, BookReadingProgress.book_id == Book.id)
            .filter(
                Book.user_id == user.id,
                BookReadingProgress.user_id != user.id,
                BookReadingProgress.status == BookStatus.READING,
            )
            .distinct()
            .all()
        )
    }

    for book in list(user.books):
        if book.id in retained_book_ids:
            book.user_id = None
        else:
            db.delete(book)

    db.query(Review).filter(Review.user_id == user.id).delete(synchronize_session=False)
    db.query(ReadingHistory).filter(ReadingHistory.user_id == user.id).delete(
        synchronize_session=False
    )
    db.query(BookReadingProgress).filter(BookReadingProgress.user_id == user.id).delete(
        synchronize_session=False
    )
    db.query(Follow).filter(
        or_(Follow.follower_id == user.id, Follow.following_id == user.id)
    ).delete(synchronize_session=False)
    db.query(Friendship).filter(
        or_(
            Friendship.user_one_id == user.id,
            Friendship.user_two_id == user.id,
            Friendship.requested_by_id == user.id,
        )
    ).delete(synchronize_session=False)

    db.flush()
    db.delete(user)
    db.commit()
    return AdminUserDeletionOut(
        deleted_username=username,
        retained_book_count=len(retained_book_ids),
    )
