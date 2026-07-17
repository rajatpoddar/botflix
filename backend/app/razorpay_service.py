import hmac
import hashlib
import logging

import razorpay

from app.config import settings

logger = logging.getLogger(__name__)

# Monthly plan amount in paise (₹49 = 4900 paise)
PLAN_AMOUNT_PAISE = 4900
PLAN_CURRENCY = "INR"
PLAN_INTERVAL = 1
PLAN_PERIOD = "monthly"

# Cache the plan ID after first fetch to avoid repeated API calls
_cached_plan_id: str | None = None


def _get_client() -> razorpay.Client:
    """Get an authenticated Razorpay client."""
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


# ── Plans ─────────────────────────────────────────────────────────────────────

def ensure_plan() -> str | None:
    """Find or create a monthly ₹49 Razorpay plan. Returns the plan_id."""
    global _cached_plan_id
    if _cached_plan_id:
        return _cached_plan_id

    try:
        client = _get_client()
        # Try to find an existing plan
        plans = client.plan.all({"count": 50})
        for plan in plans.get("items", []):
            if (
                plan.get("amount") == PLAN_AMOUNT_PAISE
                and plan.get("currency") == PLAN_CURRENCY
                and plan.get("period") == PLAN_PERIOD
                and plan.get("interval") == PLAN_INTERVAL
            ):
                logger.info("Found existing Razorpay plan: %s", plan["id"])
                _cached_plan_id = plan["id"]
                return _cached_plan_id

        # Create new plan
        plan_data = {
            "period": PLAN_PERIOD,
            "interval": PLAN_INTERVAL,
            "item": {
                "name": "StreamX Premium Monthly",
                "description": "Unlimited movies & TV shows streaming",
                "amount": PLAN_AMOUNT_PAISE,
                "currency": PLAN_CURRENCY,
            },
            "notes": {
                "product": "StreamX",
            },
        }
        plan = client.plan.create(plan_data)
        _cached_plan_id = plan["id"]
        logger.info("Created Razorpay plan: %s", plan["id"])
        return _cached_plan_id
    except Exception as exc:
        logger.error("Failed to create/find Razorpay plan: %s", exc)
        return None


# ── Subscriptions (AutoPay) ───────────────────────────────────────────────────

def create_subscription(plan_id: str, user_email: str, user_name: str) -> dict | None:
    """Create a recurring subscription with AutoPay for a user.
    
    Returns a dict with `id`, `short_url`, and `status` on success.
    The frontend should redirect the user to `short_url` to complete payment.
    """
    try:
        client = _get_client()
        # AutoPay = customer is automatically charged each cycle
        # total_count = 24 means 24 months (2 years) — effectively permanent
        subscription_data = {
            "plan_id": plan_id,
            "total_count": 24,
            "quantity": 1,
            "customer_notify": 1,
            "notes": {
                "email": user_email,
                "name": user_name,
            },
        }
        subscription = client.subscription.create(subscription_data)
        logger.info(
            "Created Razorpay subscription %s for %s",
            subscription["id"],
            user_email,
        )
        return {
            "id": subscription["id"],
            "short_url": subscription.get("short_url"),
            "status": subscription.get("status"),
        }
    except Exception as exc:
        logger.error("Failed to create Razorpay subscription: %s", exc)
        return None


def verify_payment_signature(
    razorpay_payment_id: str,
    razorpay_subscription_id: str,
    razorpay_signature: str,
) -> bool:
    """Verify the payment signature returned by Razorpay Checkout."""
    try:
        expected_signature = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            f"{razorpay_payment_id}|{razorpay_subscription_id}".encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected_signature, razorpay_signature)
    except Exception as exc:
        logger.error("Signature verification failed: %s", exc)
        return False


def verify_webhook_signature(payload: bytes, signature: str, webhook_secret: str) -> bool:
    """Verify a Razorpay webhook signature."""
    try:
        expected_signature = hmac.new(
            webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected_signature, signature)
    except Exception as exc:
        logger.error("Webhook signature verification failed: %s", exc)
        return False


def get_subscription_by_id(subscription_id: str) -> dict | None:
    """Fetch a Razorpay subscription by its ID to check status."""
    try:
        client = _get_client()
        sub = client.subscription.fetch(subscription_id)
        return {
            "id": sub["id"],
            "status": sub.get("status"),
            "current_start": sub.get("current_start"),
            "current_end": sub.get("current_end"),
            "paid_count": sub.get("paid_count"),
        }
    except Exception as exc:
        logger.error("Failed to fetch subscription %s: %s", subscription_id, exc)
        return None
