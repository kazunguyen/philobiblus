import base64
import os
import threading

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.auth import get_current_user
from app.models import User
from app.rate_limit import enforce_rate_limit
from app.schemas import ImageUploadOut


router = APIRouter(
    prefix="/api/uploads",
    tags=["Uploads"],
)

MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_UPLOAD_REQUEST_SIZE = 12 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}
IMGBB_TIMEOUT_SECONDS = float(os.getenv("IMGBB_TIMEOUT_SECONDS", "15"))
UPLOAD_MAX_CONCURRENCY = max(1, int(os.getenv("UPLOAD_MAX_CONCURRENCY", "2")))
upload_semaphore = threading.BoundedSemaphore(UPLOAD_MAX_CONCURRENCY)


def _matches_image_signature(content_type: str, image_bytes: bytes) -> bool:
    signatures = {
        "image/jpeg": lambda value: value.startswith(b"\xff\xd8\xff"),
        "image/png": lambda value: value.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/gif": lambda value: value.startswith((b"GIF87a", b"GIF89a")),
        "image/webp": lambda value: (
            len(value) >= 12
            and value.startswith(b"RIFF")
            and value[8:12] == b"WEBP"
        ),
    }
    return signatures[content_type](image_bytes)


@router.post(
    "/cover",
    response_model=ImageUploadOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a book cover to ImgBB",
)
def upload_cover(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an authenticated user's cover image to ImgBB and return its URL."""
    enforce_rate_limit(
        request=request,
        scope="upload",
        limit=3,
        window_seconds=600,
        identity=f"user:{current_user.id}",
    )

    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_UPLOAD_REQUEST_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Upload request is too large",
        )

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
    if not _matches_image_signature(file.content_type, image_bytes):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Image content does not match its declared type",
        )

    api_key = os.getenv("IMGBB_API", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload service is not configured",
        )

    if not upload_semaphore.acquire(blocking=False):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Image upload capacity is temporarily exhausted",
            headers={"Retry-After": "15"},
        )
    try:
        try:
            response = httpx.post(
                "https://api.imgbb.com/1/upload",
                data={
                    "key": api_key,
                    "image": base64.b64encode(image_bytes).decode("ascii"),
                },
                timeout=IMGBB_TIMEOUT_SECONDS,
            )
            response_data = response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Image upload service is unavailable",
            ) from error
    finally:
        upload_semaphore.release()

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
