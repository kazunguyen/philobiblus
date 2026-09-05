from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Book, BookVisibility, User
from app.schemas import BookOut, UserPublicOut


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

    return {
        "user": UserPublicOut.model_validate(user),
        "books": [BookOut.model_validate(book) for book in books],
    }
