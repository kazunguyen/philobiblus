from typing import List, Literal, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_user
from app.database import get_db
from app.models import Follow, Friendship, FriendshipStatus, User
from app.schemas import (
    FollowOut,
    FriendshipOut,
    RelationshipOut,
    UserPublicOut,
)

router = APIRouter(
    prefix="/api",
    tags=["Social"],
)


def get_target_user(username: str, db: Session) -> User:
    """Return the target user or raise a not-found error."""
    target_user = db.query(User).filter(User.username == username).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return target_user


def get_friendship_pair(first_user_id: int, second_user_id: int) -> Tuple[int, int]:
    """Return a consistently ordered pair for a friendship."""
    return min(first_user_id, second_user_id), max(first_user_id, second_user_id)


def get_friendship(
    first_user_id: int,
    second_user_id: int,
    db: Session,
) -> Optional[Friendship]:
    """Return the friendship shared by two users, if it exists."""
    user_one_id, user_two_id = get_friendship_pair(
        first_user_id,
        second_user_id,
    )

    return (
        db.query(Friendship)
        .options(
            joinedload(Friendship.requested_by),
            joinedload(Friendship.user_one),
            joinedload(Friendship.user_two),
        )
        .filter(
            Friendship.user_one_id == user_one_id,
            Friendship.user_two_id == user_two_id,
        )
        .first()
    )


@router.post(
    "/users/{username}/follow",
    response_model=FollowOut,
    status_code=status.HTTP_201_CREATED,
)
def follow_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FollowOut:
    """Create a directed follow relationship."""
    target_user = get_target_user(username, db)

    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Users cannot follow themselves",
        )

    existing_follow = (
        db.query(Follow)
        .filter(
            Follow.follower_id == current_user.id,
            Follow.following_id == target_user.id,
        )
        .first()
    )

    if existing_follow:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Already following this user",
        )

    follow = Follow(
        follower_id=current_user.id,
        following_id=target_user.id,
    )
    db.add(follow)
    db.commit()
    db.refresh(follow)

    return follow


@router.delete(
    "/users/{username}/follow",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unfollow_user(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Remove the authenticated user's follow relationship."""
    target_user = get_target_user(username, db)

    follow = (
        db.query(Follow)
        .filter(
            Follow.follower_id == current_user.id,
            Follow.following_id == target_user.id,
        )
        .first()
    )

    if not follow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Follow relationship not found",
        )

    db.delete(follow)
    db.commit()


@router.get(
    "/users/{username}/relationship",
    response_model=RelationshipOut,
)
def get_relationship(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RelationshipOut:
    """Return the authenticated user's relationship to a target user."""
    target_user = get_target_user(username, db)

    is_following = (
        db.query(Follow)
        .filter(
            Follow.follower_id == current_user.id,
            Follow.following_id == target_user.id,
        )
        .first()
        is not None
    )

    friendship = get_friendship(current_user.id, target_user.id, db)

    return RelationshipOut(
        target_user=UserPublicOut.model_validate(target_user),
        is_following=is_following,
        friendship=(
            FriendshipOut.model_validate(friendship)
            if friendship
            else None
        ),
    )


@router.get(
    "/users/{username}/followers",
    response_model=List[UserPublicOut],
)
def get_followers(
    username: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> List[UserPublicOut]:
    """Return users who follow the target user."""
    target_user = get_target_user(username, db)

    return (
        db.query(User)
        .join(Follow, Follow.follower_id == User.id)
        .filter(Follow.following_id == target_user.id)
        .order_by(User.username.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get(
    "/users/{username}/following",
    response_model=List[UserPublicOut],
)
def get_following(
    username: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> List[UserPublicOut]:
    """Return users followed by the target user."""
    target_user = get_target_user(username, db)

    return (
        db.query(User)
        .join(Follow, Follow.following_id == User.id)
        .filter(Follow.follower_id == target_user.id)
        .order_by(User.username.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post(
    "/users/{username}/friend-requests",
    response_model=FriendshipOut,
    status_code=status.HTTP_201_CREATED,
)
def create_friend_request(
    username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FriendshipOut:
    """Create a pending friendship request."""
    target_user = get_target_user(username, db)

    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Users cannot send friend requests to themselves",
        )

    existing_friendship = get_friendship(
        current_user.id,
        target_user.id,
        db,
    )

    if existing_friendship:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A friendship relationship already exists",
        )

    user_one_id, user_two_id = get_friendship_pair(
        current_user.id,
        target_user.id,
    )
    friendship = Friendship(
        user_one_id=user_one_id,
        user_two_id=user_two_id,
        requested_by_id=current_user.id,
        status=FriendshipStatus.PENDING,
    )
    db.add(friendship)
    db.commit()
    db.refresh(friendship)

    return friendship


@router.get(
    "/users/me/friend-requests",
    response_model=List[FriendshipOut],
)
def get_friend_requests(
    direction: Literal["incoming", "outgoing"] = Query("incoming"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[FriendshipOut]:
    """Return pending friend requests for the authenticated user."""
    query = (
        db.query(Friendship)
        .options(
            joinedload(Friendship.requested_by),
            joinedload(Friendship.user_one),
            joinedload(Friendship.user_two),
        )
        .filter(Friendship.status == FriendshipStatus.PENDING)
    )

    if direction == "incoming":
        query = query.filter(
            Friendship.requested_by_id != current_user.id,
            (Friendship.user_one_id == current_user.id)
            | (Friendship.user_two_id == current_user.id),
        )
    else:
        query = query.filter(Friendship.requested_by_id == current_user.id)

    return query.order_by(Friendship.created_at.desc()).all()


@router.put(
    "/friendships/{friendship_id}/accept",
    response_model=FriendshipOut,
)
def accept_friend_request(
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FriendshipOut:
    """Accept a pending request when the current user is its recipient."""
    friendship = (
        db.query(Friendship)
        .filter(Friendship.id == friendship_id)
        .first()
    )

    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friendship not found",
        )

    if current_user.id not in {
        friendship.user_one_id,
        friendship.user_two_id,
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not part of this friendship",
        )

    if friendship.requested_by_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the request recipient can accept it",
        )

    if friendship.status != FriendshipStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Friendship request is no longer pending",
        )

    friendship.status = FriendshipStatus.ACCEPTED
    db.commit()
    db.refresh(friendship)

    return friendship


@router.delete(
    "/friendships/{friendship_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_friendship(
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Cancel, decline, or remove a friendship involving the current user."""
    friendship = (
        db.query(Friendship)
        .filter(Friendship.id == friendship_id)
        .first()
    )

    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friendship not found",
        )

    if current_user.id not in {
        friendship.user_one_id,
        friendship.user_two_id,
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not part of this friendship",
        )

    db.delete(friendship)
    db.commit()