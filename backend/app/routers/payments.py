import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.razorpay_service import (
    create_subscription,
    ensure_plan,
    get_subscription_by_id,
    verify_payment_signature,
    verify_webhook_signature,
)
from app.schemas import (
    MessageResponse,
    RazorpayCreateSubscriptionResponse,
    RazorpayVerifyRequest,
)
from app.config import settings
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/payments", tags=["payments"])
logger = logging.getLogger(__name__)


# ── Create Subscription ───────────────────────────────────────────────────────

@router.post("/create-subscription", response_model=RazorpayCreateSubscriptionResponse)
async def create_subscription_endpoint(
    current_user: User = Depends(get_current_user),
):
    """Create a Razorpay AutoPay subscription for the current user.
    
    Returns the `subscription_id` and `short_url`. The frontend should
    redirect the user to `short_url` to complete authorization.
    """
    # Ensure we have a plan
    plan_id = ensure_plan()
    if not plan_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set up payment plan. Please try again.",
        )

    # Create subscription
    result = create_subscription(
        plan_id=plan_id,
        user_email=current_user.email,
        user_name=current_user.username,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription. Please try again.",
        )

    return RazorpayCreateSubscriptionResponse(
        subscription_id=result["id"],
        short_url=result["short_url"],
        status=result["status"],
    )


# ── Verify Payment ────────────────────────────────────────────────────────────

@router.post("/verify", response_model=MessageResponse)
async def verify_payment(
    payload: RazorpayVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify a Razorpay payment after the user completes checkout.
    
    Once verified, activate the user's subscription.
    """
    # Verify signature
    valid = verify_payment_signature(
        razorpay_payment_id=payload.razorpay_payment_id,
        razorpay_subscription_id=payload.razorpay_subscription_id,
        razorpay_signature=payload.razorpay_signature,
    )
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment verification failed. Invalid signature.",
        )

    # Fetch subscription details from Razorpay to confirm status
    sub_details = get_subscription_by_id(payload.razorpay_subscription_id)
    if not sub_details:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not verify subscription with payment provider.",
        )

    # Activate the user's subscription only if payment is confirmed
    now = datetime.now(timezone.utc)
    sub_status = sub_details.get("status", "")
    if sub_status not in ("active", "authenticated", "completed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment not yet confirmed (status: {sub_status}). Please try again later.",
        )

    current_user.subscription_status = "active"
    current_user.subscription_ends_at = now + timedelta(days=30)
    await db.commit()
    logger.info(
        "Subscription activated for user %s (Razorpay: %s)",
        current_user.username,
        payload.razorpay_subscription_id,
    )
    return MessageResponse(message="Subscription activated successfully!")


# ── Webhook ──────────────────────────────────────────────────────────────────

@router.post("/razorpay-webhook")
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle incoming Razorpay webhook events."""
    try:
        payload = await request.body()
        signature = request.headers.get("x-razorpay-signature", "")
        webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET or ""

        # Verify webhook signature (if a secret is configured)
        if webhook_secret:
            if not verify_webhook_signature(payload, signature, webhook_secret):
                logger.warning("Webhook signature verification failed")
                return {"status": "ignored"}

        import json
        event = json.loads(payload)
        event_type = event.get("event", "")
        logger.info("Razorpay webhook received: %s", event_type)

        # Handle subscription charged event
        if event_type == "subscription.charged":
            sub_payload = event.get("payload", {}).get("subscription", {})
            sub_entity = sub_payload.get("entity", {})
            razorpay_sub_id = sub_entity.get("id", "")

            if razorpay_sub_id:
                # Find user by subscription data (we stored email in notes)
                notes = sub_entity.get("notes", {})
                user_email = notes.get("email", "")

                if user_email:
                    result = await db.execute(
                        select(User).where(User.email == user_email)
                    )
                    user = result.scalar_one_or_none()
                    if user:
                        now = datetime.now(timezone.utc)
                        user.subscription_status = "active"
                        user.subscription_ends_at = now + timedelta(days=30)
                        await db.commit()
                        logger.info(
                            "Webhook: Activated subscription for %s",
                            user.email,
                        )

        elif event_type == "subscription.cancelled":
            sub_payload = event.get("payload", {}).get("subscription", {})
            sub_entity = sub_payload.get("entity", {})
            notes = sub_entity.get("notes", {})
            user_email = notes.get("email", "")
            if user_email:
                result = await db.execute(
                    select(User).where(User.email == user_email)
                )
                user = result.scalar_one_or_none()
                if user and user.subscription_status == "active":
                    user.subscription_status = "cancelled"
                    await db.commit()
                    logger.info("Webhook: Cancelled subscription for %s", user.email)

        return {"status": "ok"}
    except Exception as exc:
        logger.error("Webhook handler error: %s", exc)
        return {"status": "error", "detail": str(exc)}
