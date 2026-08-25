from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import BookStatus


# --- User Schemas ---

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: Optional[datetime] = None

class UserPublicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    created_at: Optional[datetime] = None


# --- Token Schemas (JWT) ---

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# --- Book Schemas ---

class BookBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    author: str = Field(..., min_length=1, max_length=255)
    genre: str = Field(..., max_length=100)
    status: BookStatus = BookStatus.WANT_TO_READ
    rating: Optional[int] = Field(None, ge=1, le=5)
    volume: Optional[int] = Field(None, ge=1)
    cover_url: Optional[str] = Field(None, max_length=500)
    pages_total: Optional[int] = Field(None, ge=0)
    pages_read: int = Field(0, ge=0)
    date_started: Optional[date] = None
    date_finished: Optional[date] = None
    notes: Optional[str] = None


class BookCreate(BookBase):
    pass


class BookUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    author: Optional[str] = Field(None, min_length=1, max_length=255)
    genre: Optional[str] = Field(None, max_length=100)
    status: Optional[BookStatus] = None
    rating: Optional[int] = Field(None, ge=1, le=5)
    volume: Optional[int] = Field(None, ge=1)
    cover_url: Optional[str] = Field(None, max_length=500)
    pages_total: Optional[int] = Field(None, ge=0)
    pages_read: Optional[int] = Field(None, ge=0)
    date_started: Optional[date] = None
    date_finished: Optional[date] = None
    notes: Optional[str] = None


class BookOut(BookBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class BookPublicOut(BookOut):
    owner: UserPublicOut