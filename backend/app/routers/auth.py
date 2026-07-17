import asyncio
import logging
import secrets
from datetime import datetime, timedelta, timezone


# ── Helper: ensure timezone-naive DB values work with timezone-aware comparisons ──
def _safe_compare(dt_a, dt_b):
    """Make two datetimes compatible for comparison by stripping timezone from
    both. This handles the case where one is naive (SQLite) and the other is
    timezone-aware (PostgreSQL). Returns (dt_a, dt_b) both stripped of tz."""
    def strip_tz(d):
        return d.replace(tzinfo=None) if d and d.tzinfo is not None else d
    return strip_tz(dt_a), strip_tz(dt_b)

from fastapi import APIRouter, Depends, HTTPException, status
from httpx import AsyncClient as HttpxClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import jellyfin as jf
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.email_service import send_password_reset_email, send_welcome_email
from app.models import User
from app.schemas import (
    ForgotPasswordRequest,
    GoogleLoginRequest,
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
    now = datetime.now(timezone.utc)
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

    # Send welcome email (fire-and-forget — don't delay the registration response)
    try:
        trial_end = (now + timedelta(days=7)).strftime("%B %d, %Y")
        asyncio.create_task(
            asyncio.to_thread(
                send_welcome_email,
                to_email=user.email,
                username=user.username,
                trial_end_date=trial_end,
            )
        )
    except Exception as exc:
        logger.warning("Failed to schedule welcome email for %s: %s", user.email, exc)

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
        avatar_url=user.avatar_url,
    )


# ── Google OAuth ───────────────────────────────────────────────────────────────

async def verify_google_token(credential: str) -> dict:
    """Verify a Google ID token using Google's tokeninfo endpoint."""
    try:
        async with HttpxClient() as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": credential},
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Google token",
                )
            data = resp.json()
            # Verify the audience (client ID) matches our app
            if data.get("aud") != settings.GOOGLE_CLIENT_ID:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token audience mismatch",
                )
            return data
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Google token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to verify Google token",
        )


@router.post("/google", response_model=LoginResponse)
async def google_login(
    payload: GoogleLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Sign in or register with a Google ID token."""
    # Verify the token with Google
    google_data = await verify_google_token(payload.credential)

    google_id = google_data["sub"]
    email = google_data.get("email", "")
    google_name = google_data.get("name", "")
    picture = google_data.get("picture", "")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account has no email",
        )

    # Look up existing user by google_id or email
    result = await db.execute(
        select(User).where(
            (User.google_id == google_id) | (User.email == email)
        )
    )
    user = result.scalar_one_or_none()

    if user:
        # Existing user — link google_id if not already linked
        if not user.google_id:
            user.google_id = google_id
        if picture and not user.avatar_url:
            user.avatar_url = picture
        await db.commit()
        await db.refresh(user)

        # Authenticate against Jellyfin using stored jellyfin_password
        if not user.jellyfin_password:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Jellyfin credentials not configured for this account",
            )

        try:
            jf_auth = await jf.authenticate_jellyfin_user(
                user.username, user.jellyfin_password
            )
            jellyfin_token = jf_auth["AccessToken"]
            jellyfin_user_id = jf_auth["User"]["Id"]
        except Exception as exc:
            logger.error("Jellyfin auth failed for Google user %s: %s", user.username, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Media server authentication failed",
            )
    else:
        # New user — create account
        now = datetime.now(timezone.utc)

        # Derive a unique username from the Google name/email
        base_username = (
            google_name.lower().replace(" ", "_").replace("-", "_")[:20]
            or email.split("@")[0][:20]
        )
        # Remove non-alphanumeric characters except underscore/hyphen
        base_username = "".join(c for c in base_username if c.isalnum() or c in "_-")
        if not base_username or len(base_username) < 3:
            base_username = email.split("@")[0][:20]

        # Ensure username is unique
        username = base_username
        counter = 1
        while True:
            existing = await db.execute(
                select(User).where(User.username == username)
            )
            if not existing.scalar_one_or_none():
                break
            username = f"{base_username[:16]}_{counter}"
            counter += 1

        # Generate random passwords
        random_password = secrets.token_urlsafe(16)
        jellyfin_pw = secrets.token_urlsafe(16)

        # Create Jellyfin user
        try:
            jf_user = await jf.create_jellyfin_user(username, jellyfin_pw)
            jellyfin_user_id = jf_user.get("Id")
        except Exception as exc:
            logger.error("Jellyfin user creation failed for Google user %s: %s", username, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not create media account. Please try again.",
            )

        # Persist user
        user = User(
            email=email,
            username=username,
            hashed_password=hash_password(random_password),
            jellyfin_user_id=jellyfin_user_id,
            jellyfin_password=jellyfin_pw,
            google_id=google_id,
            avatar_url=picture,
            subscription_status="trial",
            trial_started_at=now,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        # Authenticate against Jellyfin with the generated password
        try:
            jf_auth = await jf.authenticate_jellyfin_user(username, jellyfin_pw)
            jellyfin_token = jf_auth["AccessToken"]
        except Exception as exc:
            logger.error("Jellyfin auth failed for new Google user %s: %s", username, exc)
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
        avatar_url=user.avatar_url,
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

        # Send password reset email (user expects to wait a moment)
        try:
            await asyncio.to_thread(
                send_password_reset_email,
                to_email=user.email,
                username=user.username,
                reset_token=token,
            )
        except Exception as exc:
            logger.warning("Failed to send reset email to %s: %s", user.email, exc)

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


# ── Subscription ──────────────────────────────────────────────────────────────

@router.get("/subscription", response_model=SubscriptionStatus)
async def get_subscription(
    current_user: User = Depends(get_current_user),
) -> SubscriptionStatus:
    """Return the current user's subscription status and trial info."""
    now = datetime.now(timezone.utc)
    status = current_user.subscription_status or "trial"

    # If still in trial, check if 7 days have passed
    if status == "trial":
        if current_user.trial_started_at:
            trial_end = current_user.trial_started_at + timedelta(days=7)
            # Make compatible for comparison (handles naive vs aware datetime mismatch)
            comp_now, comp_end = _safe_compare(now, trial_end)
            if comp_now > comp_end:
                # Trial expired — mark it
                status = "expired"
        else:
            # Trial hasn't started yet (new user) — still valid
            pass

    # Calculate days remaining
    days_remaining = None
    if status == "trial" and current_user.trial_started_at:
        trial_end = current_user.trial_started_at + timedelta(days=7)
        _, comp_trial_end = _safe_compare(now, trial_end)
        remaining = (comp_trial_end - now.replace(tzinfo=None)).days
        days_remaining = max(0, remaining)
    elif status == "active" and current_user.subscription_ends_at:
        comp_sub_end, comp_now = _safe_compare(current_user.subscription_ends_at, now)
        remaining = (comp_sub_end - comp_now).days
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

    now = datetime.now(timezone.utc)
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
    now = datetime.now(timezone.utc)
    current_user.subscription_status = "active"
    current_user.subscription_ends_at = now + timedelta(days=30)  # 1 month
    await db.commit()
    await db.refresh(current_user)

    return SubscriptionStatus(
        status="active",
        trial_started_at=current_user.trial_started_at,
        subscription_ends_at=current_user.subscription_ends_at,
    )
