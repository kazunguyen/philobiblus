from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.database import get_db
from app.models import User
from app.schemas import Token, UserCreate, UserOut

router = APIRouter(
    prefix="/api/auth",
    tags=["Auth"],
)


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký tài khoản mới",
)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Kiểm tra trùng lặp username/email, mã hóa mật khẩu và tạo User mới."""
    # Kiểm tra trùng lặp username
    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    # Kiểm tra trùng lặp email
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Hash mật khẩu và lưu vào Database
    hashed_pwd = get_password_hash(user_in.password)
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_pwd,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post(
    "/login",
    response_model=Token,
    summary="Đăng nhập và nhận JWT Access Token",
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Xác thực thông tin đăng nhập và trả về Bearer Token."""
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account",
        )

    access_token = create_access_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.get(
    "/me",
    response_model=UserOut,
    summary="Lấy thông tin User đang đăng nhập",
)
def read_current_user(current_user: User = Depends(get_current_user)):
    """Trả về thông tin chi tiết của User sở hữu Token hiện tại."""
    return current_user