import enum
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Float,
    Integer,
    String,
    Text,
    func,
    CheckConstraint,
    UniqueConstraint,
    JSON
)
from sqlalchemy.orm import relationship

from app.database import Base


class BookStatus(str, enum.Enum):
    WANT_TO_READ = "want_to_read"
    READING = "reading"
    COMPLETED = "completed"
    DROPPED = "dropped"


class BookVisibility(str, enum.Enum):
    PUBLIC = "public"
    RESTRICTED = "restricted"
    PRIVATE = "private"


class PublicationStatus(str, enum.Enum):
    ONGOING = "ongoing"
    COMPLETED = "completed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    settings = relationship(
        "UserSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # One-to-many relationship with books table
    books = relationship("Book", back_populates="owner", cascade="all, delete-orphan")
    reviews = relationship(
        "Review",
        back_populates="reviewer",
        cascade="all, delete-orphan",
    )
    followers = relationship(
        "Follow",
        foreign_keys="Follow.following_id",
        back_populates="following",
        cascade="all, delete-orphan",
    )
    following = relationship(
        "Follow",
        foreign_keys="Follow.follower_id",
        back_populates="follower",
        cascade="all, delete-orphan",
    )



class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    theme = Column(String(20), nullable=False, default="light", server_default="light")
    default_book_view = Column(
        String(20),
        nullable=False,
        default="grid",
        server_default="grid",
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="settings")


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    title = Column(String(255), nullable=False, index=True)
    author = Column(String(255), nullable=False, index=True)
    genre = Column(String(100), nullable=True)
    tags = Column(
        JSON,
        nullable=False,
        default=list,
        server_default="[]",
    )
    visibility = Column(
        Enum(
            BookVisibility,
            name="book_visibility_enum",
            native_enum=False,
            values_callable=lambda values: [member.value for member in values],
        ),
        default=BookVisibility.PUBLIC,
        server_default="public",
        nullable=False,
    )
    share_token = Column(String(64), unique=True, nullable=True, index=True)
    publication_status = Column(
        Enum(
            PublicationStatus,
            name="publication_status_enum",
            native_enum=False,
            values_callable=lambda values: [member.value for member in values],
        ),
        default=PublicationStatus.ONGOING,
        server_default="ongoing",
        nullable=False,
    )
    
    status = Column(
        Enum(BookStatus, name="book_status_enum", native_enum=False),
        default=BookStatus.WANT_TO_READ,
        nullable=False,
    )
    rating = Column(Integer, nullable=True)
    # A value of -1 means that the owner has not supplied this number yet.
    volume = Column(Integer, default=-1, server_default="-1", nullable=False)
    pages_total = Column(Integer, default=-1, server_default="-1", nullable=False)
    pages_read = Column(Integer, default=-1, server_default="-1", nullable=False)
    chapters_read = Column(Float, default=-1.0, server_default="-1", nullable=False)
    
    date_started = Column(Date, nullable=True)
    date_finished = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    cover_url = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Many-to-one relationship with users table
    owner = relationship("User", back_populates="books")

    reviews = relationship(
        "Review",
        back_populates="book",
        cascade="all, delete-orphan",
    )

    reading_history = relationship(
        "ReadingHistory",
        back_populates="book",
        cascade="all, delete-orphan",
    )

class ReadingHistory(Base):
    __tablename__ = "reading_history"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(
        Integer,
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    read_on = Column(
        Date,
        nullable=False,
        server_default=func.current_date(),
        index=True,
    )
    # Snapshot values use the same -1 sentinel as Book for values not supplied.
    pages_read = Column(Integer, default=-1, server_default="-1", nullable=False)
    chapters_read = Column(Float, default=-1.0, server_default="-1", nullable=False)
    chapter = Column(String(100), nullable=True)
    volume = Column(Integer, default=-1, server_default="-1", nullable=False)
    note = Column(Text, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    book = relationship("Book", back_populates="reading_history")
    user = relationship("User")

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(
        Integer,
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    book = relationship("Book", back_populates="reviews")
    reviewer = relationship("User", back_populates="reviews")

class FriendshipStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"

class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (
        CheckConstraint(
            "follower_id != following_id",
            name="check_follow_users_are_different",
        ),
        UniqueConstraint(
            "follower_id",
            "following_id",
            name="unique_follow_relationship",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    following_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    follower = relationship(
        "User",
        foreign_keys=[follower_id],
        back_populates="following",
    )
    following = relationship(
        "User",
        foreign_keys=[following_id],
        back_populates="followers",
    )


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (
        CheckConstraint(
            "user_one_id < user_two_id",
            name="check_friendship_user_order",
        ),
        CheckConstraint(
            "requested_by_id = user_one_id OR requested_by_id = user_two_id",
            name="check_requester_is_friendship_member",
        ),
        UniqueConstraint(
            "user_one_id",
            "user_two_id",
            name="unique_friendship_pair",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_one_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_two_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(
        Enum(
            FriendshipStatus,
            name="friendship_status_enum",
            native_enum=False,
        ),
        default=FriendshipStatus.PENDING,
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user_one = relationship("User", foreign_keys=[user_one_id])
    user_two = relationship("User", foreign_keys=[user_two_id])
    requested_by = relationship("User", foreign_keys=[requested_by_id])
