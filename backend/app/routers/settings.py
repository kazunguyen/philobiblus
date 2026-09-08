from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, UserSettings
from app.schemas import UserSettingsOut, UserSettingsUpdate


router = APIRouter(
    prefix="/api/settings",
    tags=["Settings"],
)


def get_or_create_settings(current_user: User, db: Session) -> UserSettings:
    settings = (
        db.query(UserSettings)
        .filter(UserSettings.user_id == current_user.id)
        .first()
    )

    if settings:
        return settings

    settings = UserSettings(user_id=current_user.id)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("", response_model=UserSettingsOut, summary="Get current user settings")
def read_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current user's settings, creating defaults on first access."""
    return get_or_create_settings(current_user, db)


@router.put("", response_model=UserSettingsOut, summary="Update current user settings")
def update_settings(
    settings_in: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update only the settings supplied by the authenticated user."""
    settings = get_or_create_settings(current_user, db)
    updates = settings_in.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(settings, field, value)

    db.commit()
    db.refresh(settings)
    return settings
