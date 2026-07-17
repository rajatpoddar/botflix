import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username must be alphanumeric (underscores/hyphens allowed)")
        if len(v) < 3 or len(v) > 30:
            raise ValueError("Username must be between 3 and 30 characters")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    username: str  # can be username or email
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    jellyfin_token: str
    jellyfin_user_id: str
    username: str
    email: str
    avatar_url: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class GoogleLoginRequest(BaseModel):
    """ID token from Google Identity Services."""
    credential: str
    client_id: str | None = None


# ── User ──────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Subscription ──────────────────────────────────────────────────────────────

class SubscriptionStatus(BaseModel):
    status: str  # 'trial' | 'active' | 'expired' | 'cancelled'
    trial_started_at: datetime | None = None
    subscription_ends_at: datetime | None = None
    days_remaining: int | None = None

    model_config = {"from_attributes": True}


# ── Razorpay / Payments ───────────────────────────────────────────────────────

class RazorpayCreateSubscriptionResponse(BaseModel):
    subscription_id: str
    short_url: str
    status: str


class RazorpayVerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str


# ── Generic ───────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
