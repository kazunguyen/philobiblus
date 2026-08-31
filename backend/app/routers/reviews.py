from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models import Book, Review, User
from app.schemas import ReviewCreate, ReviewOut

router = APIRouter(
    prefix="/api",
    tags=["Reviews"],
)


@router.post(
    "/books/{book_id}/reviews",
    response_model=ReviewOut,
    status_code=status.HTTP_201_CREATED,
)
def create_review(
    book_id: int,
    review_in: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a review for an existing book."""
    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    review = Review(
        book_id=book_id,
        user_id=current_user.id,
        rating=review_in.rating,
        comment=review_in.comment,
    )

    db.add(review)
    db.commit()
    db.refresh(review)

    return review


@router.get(
    "/books/{book_id}/reviews",
    response_model=List[ReviewOut],
)
def get_book_reviews(
    book_id: int,
    db: Session = Depends(get_db),
):
    """Return public reviews for a book."""
    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    return (
        db.query(Review)
        .options(joinedload(Review.reviewer))
        .filter(Review.book_id == book_id)
        .order_by(Review.created_at.desc())
        .all()
    )


@router.delete(
    "/reviews/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a review owned by the authenticated user."""
    review = (
        db.query(Review)
        .filter(
            Review.id == review_id,
            Review.user_id == current_user.id,
        )
        .first()
    )

    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    db.delete(review)
    db.commit()
    return None