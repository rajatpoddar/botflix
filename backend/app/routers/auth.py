import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import jellyfin as jf
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    SubscriptionStatus,
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

    # Persist to our database — auto-start the 7-day free trial
    now = datetime.utcnow()
    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
        jellyfin_user_id=jellyfin_user_id,
        subscription_status="trial",
        trial_started_at=now,
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
        email=user.email,
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

    if user.reset_token_expires < datetime.utcnow():
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


# ── Subscription ──────────────────────────────────────────────────────────────

@router.get("/subscription", response_model=SubscriptionStatus)
async def get_subscription(
    current_user: User = Depends(get_current_user),
) -> SubscriptionStatus:
    """Return the current user's subscription status and trial info."""
    now = datetime.utcnow()
    status = current_user.subscription_status or "trial"

    # If still in trial, check if 7 days have passed
    if status == "trial":
        if current_user.trial_started_at:
            trial_end = current_user.trial_started_at + timedelta(days=7)
            if now > trial_end:
                # Trial expired — mark it
                status = "expired"
        else:
            # Trial hasn't started yet (new user) — still valid
            pass

    # Calculate days remaining
    days_remaining = None
    if status == "trial" and current_user.trial_started_at:
        trial_end = current_user.trial_started_at + timedelta(days=7)
        remaining = (trial_end - now).days
        days_remaining = max(0, remaining)
    elif status == "active" and current_user.subscription_ends_at:
        remaining = (current_user.subscription_ends_at - now).days
        days_remaining = max(0, remaining)

    return SubscriptionStatus(
        status=status,
        trial_started_at=current_user.trial_started_at,
        subscription_ends_at=current_user.subscription_ends_at,
        days_remaining=days_remaining,
    )


@router.post("/subscription/start-trial")
async def start_trial(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubscriptionStatus:
    """Start the 7-day free trial for a new user."""
    if current_user.trial_started_at:
        raise HTTPException(
            status_code=400,
            detail="Trial already started",
        )

    now = datetime.utcnow()
    current_user.trial_started_at = now
    current_user.subscription_status = "trial"
    await db.commit()
    await db.refresh(current_user)

    return SubscriptionStatus(
        status="trial",
        trial_started_at=now,
        subscription_ends_at=now + timedelta(days=7),
    )


@router.post("/subscription/activate")
async def activate_subscription(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubscriptionStatus:
    """Mark subscription as active (would happen after payment)."""
    now = datetime.utcnow()
    current_user.subscription_status = "active"
    current_user.subscription_ends_at = now + timedelta(days=30)  # 1 month
    await db.commit()
    await db.refresh(current_user)

    return SubscriptionStatus(
        status="active",
        trial_started_at=current_user.trial_started_at,
        subscription_ends_at=current_user.subscription_ends_at,
    )
