from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Book, ReadingHistory, User
from app.schemas import ReadingHistoryOut

router = APIRouter(
    prefix="/api/books",
    tags=["Reading History"],
)


def get_owned_book(
    book_id: int,
    current_user: User,
    db: Session,
) -> Book:
    book = (
        db.query(Book)
        .filter(
            Book.id == book_id,
            Book.user_id == current_user.id,
        )
        .first()
    )

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    return book


@router.get(
    "/{book_id}/reading-history",
    response_model=List[ReadingHistoryOut],
)
def get_reading_history(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return reading history entries for an owned book."""
    get_owned_book(book_id, current_user, db)

    return (
        db.query(ReadingHistory)
        .filter(
            ReadingHistory.book_id == book_id,
            ReadingHistory.user_id == current_user.id,
        )
        .order_by(
            ReadingHistory.read_on.asc(),
            ReadingHistory.recorded_at.asc().nullslast(),
            ReadingHistory.id.asc(),
        )
        .all()
    )


