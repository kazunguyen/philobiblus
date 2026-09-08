import base64
import os

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.auth import get_current_user
from app.models import User
from app.schemas import ImageUploadOut


router = APIRouter(
    prefix="/api/uploads",
    tags=["Uploads"],
)

MAX_IMAGE_SIZE = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}


@router.post(
    "/cover",
    response_model=ImageUploadOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a book cover to ImgBB",
)
def upload_cover(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an authenticated user's cover image to ImgBB and return its URL."""
    del current_user

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, GIF, and WebP images are supported",
        )

    image_bytes = file.file.read(MAX_IMAGE_SIZE + 1)
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Image must be 10 MB or smaller",
        )
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image file is empty",
        )

    api_key = os.getenv("IMGBB_API", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload service is not configured",
        )

    try:
        response = httpx.post(
            "https://api.imgbb.com/1/upload",
            data={
                "key": api_key,
                "image": base64.b64encode(image_bytes).decode("ascii"),
            },
            timeout=30.0,
        )
        response_data = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Image upload service is unavailable",
        ) from error

    if response.status_code >= 400 or not response_data.get("success"):
        error_data = response_data.get("error", {})
        provider_message = error_data.get("message") if isinstance(error_data, dict) else None
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=provider_message or "Image upload failed",
        )

    image_url = response_data.get("data", {}).get("url")
    if not image_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Image upload returned no URL",
        )

    return {"url": image_url}
