from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Book, BookStatus, User
from app.schemas import (
    BookCreate,
    BookOut,
    BookPublicOut,
    BookStatsOut,
    BookUpdate,
)

router = APIRouter(
    prefix="/api/books",
    tags=["Books"],
)


@router.get(
    "",
    response_model=List[BookOut],
    summary="Get book list of current user with filtering and search",
)
def get_books(
    status_filter: Optional[BookStatus] = Query(None, alias="status", description="Filter by reading status"),
    genre: Optional[str] = Query(None, description="Filter by genre"),
    search: Optional[str] = Query(None, description="Search by title or author"),
    skip: int = Query(0, ge=0, description="Number of records to skip (pagination)"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of records to retrieve"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Query list of books owned by the authenticated user."""
    query = db.query(Book).filter(Book.user_id == current_user.id)

    # Apply status filter if specified
    if status_filter:
        query = query.filter(Book.status == status_filter)

    # Apply genre filter if specified
    if genre:
        query = query.filter(Book.genre.ilike(f"%{genre}%"))

    # Apply search filter across title and author
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Book.title.ilike(search_term),
                Book.author.ilike(search_term),
            )
        )

    # Order by newest first and paginate
    books = query.order_by(Book.created_at.desc()).offset(skip).limit(limit).all()
    return books


@router.post(
    "",
    response_model=BookOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new book",
)
def create_book(
    book_in: BookCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new book record assigned to current user."""
    new_book = Book(
        **book_in.model_dump(),
        user_id=current_user.id,
    )
    db.add(new_book)
    db.commit()
    db.refresh(new_book)
    return new_book

@router.get(
    "/public",
    response_model=List[BookPublicOut],
    summary="Get public book list with filtering and search",
)
def get_public_books(
    genre: Optional[str] = Query(None, description="Filter by genre"),
    search: Optional[str] = Query(None, description="Search by title or author"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum records to retrieve"),
    db: Session = Depends(get_db),
):
    """Query books from all users for the public dashboard."""
    query = db.query(Book)

    if genre:
        query = query.filter(Book.genre.ilike(f"%{genre}%"))

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Book.title.ilike(search_term),
                Book.author.ilike(search_term),
            )
        )

    return query.order_by(Book.created_at.desc()).offset(skip).limit(limit).all()


@router.get(
    "/stats",
    response_model=BookStatsOut,
    summary="Get reading statistics for current user",
)
def get_book_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BookStatsOut:
    """Return aggregated reading statistics for the authenticated user."""
    books = (
        db.query(Book)
        .filter(Book.user_id == current_user.id)
        .all()
    )

    status_counts = {
        book_status.value: 0
        for book_status in BookStatus
    }

    for book in books:
        status_value = (
            book.status.value
            if isinstance(book.status, BookStatus)
            else book.status
        )
        status_counts[status_value] = status_counts.get(status_value, 0) + 1

    total_pages = sum(book.pages_total or 0 for book in books)
    total_pages_read = sum(book.pages_read or 0 for book in books)
    ratings = [
        book.rating
        for book in books
        if book.rating is not None
    ]

    average_rating = (
        round(sum(ratings) / len(ratings), 2)
        if ratings
        else 0.0
    )
    reading_progress = (
        round(min(total_pages_read / total_pages, 1) * 100, 2)
        if total_pages
        else 0.0
    )

    return BookStatsOut(
        total_books=len(books),
        want_to_read=status_counts[BookStatus.WANT_TO_READ.value],
        reading=status_counts[BookStatus.READING.value],
        completed=status_counts[BookStatus.COMPLETED.value],
        dropped=status_counts[BookStatus.DROPPED.value],
        total_pages=total_pages,
        total_pages_read=total_pages_read,
        average_rating=average_rating,
        reading_progress=reading_progress,
    )


@router.get(
    "/{book_id}",
    response_model=BookOut,
    summary="Get book details by ID",
)
def get_book(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve book details and verify ownership."""
    book = (
        db.query(Book)
        .filter(Book.id == book_id, Book.user_id == current_user.id)
        .first()
    )
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )
    return book


@router.put(
    "/{book_id}",
    response_model=BookOut,
    summary="Update book details or reading progress",
)
def update_book(
    book_id: int,
    book_in: BookUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update specified fields of a book record (patch update)."""
    book = (
        db.query(Book)
        .filter(Book.id == book_id, Book.user_id == current_user.id)
        .first()
    )
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    # Update only provided non-None fields
    update_data = book_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(book, field, value)

    db.commit()
    db.refresh(book)
    return book


@router.delete(
    "/{book_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a book from library",
)
def delete_book(
    book_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete book record if owned by current user."""
    book = (
        db.query(Book)
        .filter(Book.id == book_id, Book.user_id == current_user.id)
        .first()
    )
    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Book not found",
        )

    db.delete(book)
    db.commit()
    return None
