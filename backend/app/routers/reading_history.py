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


@router.delete(
    "/{book_id}/reading-history/{history_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_reading_history_entry(
    book_id: int,
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete one reading-history entry from an owned book."""
    get_owned_book(book_id, current_user, db)
    entry = (
        db.query(ReadingHistory)
        .filter(
            ReadingHistory.id == history_id,
            ReadingHistory.book_id == book_id,
            ReadingHistory.user_id == current_user.id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reading history entry not found",
        )

    db.delete(entry)
    db.commit()
    return None


@router.delete(
    "/{book_id}/reading-history",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_all_reading_history(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete every reading-history entry from an owned book."""
    get_owned_book(book_id, current_user, db)
    (
        db.query(ReadingHistory)
        .filter(
            ReadingHistory.book_id == book_id,
            ReadingHistory.user_id == current_user.id,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return None


