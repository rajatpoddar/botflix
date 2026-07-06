import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import jellyfin as jf
from app.database import get_db
from app.models import User
from app.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UserOut,
)
from app.security import (
    create_access_token,
    generate_reset_token,
    hash_password,
    reset_token_expiry,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check duplicate email / username
    existing = await db.execute(
        select(User).where(
            (User.email == payload.email) | (User.username == payload.username)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already registered",
        )

    # Create user on Jellyfin first
    try:
        jf_user = await jf.create_jellyfin_user(payload.username, payload.password)
        jellyfin_user_id = jf_user.get("Id")
    except Exception as exc:
        logger.error("Jellyfin user creation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not create media account. Please try again.",
        )

    # Persist to our database
    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
        jellyfin_user_id=jellyfin_user_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Look up user by username or email
    result = await db.execute(
        select(User).where(
            (User.username == payload.username) | (User.email == payload.username)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    # Authenticate against Jellyfin to obtain a fresh AccessToken
    try:
        jf_auth = await jf.authenticate_jellyfin_user(user.username, payload.password)
        jellyfin_token = jf_auth["AccessToken"]
        jellyfin_user_id = jf_auth["User"]["Id"]
    except Exception as exc:
        logger.error("Jellyfin auth failed for %s: %s", user.username, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Media server authentication failed",
        )

    # Issue our own JWT
    access_token = create_access_token({"sub": str(user.id)})

    return LoginResponse(
        access_token=access_token,
        jellyfin_token=jellyfin_token,
        jellyfin_user_id=jellyfin_user_id,
        username=user.username,
    )


# ── Forgot Password ───────────────────────────────────────────────────────────

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    # Always return 200 to avoid user enumeration
    if user:
        token = generate_reset_token()
        user.reset_token = token
        user.reset_token_expires = reset_token_expiry()
        await db.commit()

        # TODO: replace with real email transport
        logger.info(
            "[MOCK EMAIL] Password reset link for %s: /reset-password?token=%s",
            user.email,
            token,
        )

    return MessageResponse(
        message="If that email is registered, a reset link has been sent."
    )


# ── Reset Password ────────────────────────────────────────────────────────────

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(User).where(User.reset_token == payload.token)
    )
    user = result.scalar_one_or_none()

    if not user or not user.reset_token_expires:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")

    if user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token has expired")

    # Update password locally
    user.hashed_password = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    await db.commit()

    # Sync password to Jellyfin
    if user.jellyfin_user_id:
        try:
            await jf.update_jellyfin_password(user.jellyfin_user_id, payload.new_password)
        except Exception as exc:
            logger.error("Jellyfin password sync failed for %s: %s", user.username, exc)
            # Don't block the user — local password is already updated

    return MessageResponse(message="Password reset successfully")
