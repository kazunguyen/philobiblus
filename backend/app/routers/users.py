from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Book, BookReadingProgress, BookStatus, BookVisibility, User
from app.schemas import BookPublicOut, UserPublicOut


router = APIRouter(
    prefix="/api/users",
    tags=["Users"],
)


@router.get("/{username}", summary="Get public user profile")
def get_user_profile(username: str, db: Session = Depends(get_db)):
    """Return safe public profile data and the user's books."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    books = (
        db.query(Book)
        .filter(Book.user_id == user.id, Book.visibility == BookVisibility.PUBLIC)
        .order_by(Book.created_at.desc())
        .all()
    )
    book_ids = [book.id for book in books]
    reader_counts = {}
    if book_ids:
        reader_counts = dict(
            db.query(
                BookReadingProgress.book_id,
                func.count(BookReadingProgress.id),
            )
            .filter(
                BookReadingProgress.book_id.in_(book_ids),
                BookReadingProgress.status == BookStatus.READING,
            )
            .group_by(BookReadingProgress.book_id)
            .all()
        )
    for book in books:
        owner_is_reading = book.status == BookStatus.READING or book.status == "reading"
        book.active_reader_count = reader_counts.get(book.id, 0) + int(owner_is_reading)

    return {
        "user": UserPublicOut.model_validate(user),
        "books": [BookPublicOut.model_validate(book) for book in books],
    }
