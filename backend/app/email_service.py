import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


# ── HTML Templates ────────────────────────────────────────────────────────────

WELCOME_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #09090b; color: #e4e4e7; }}
    .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
    .card {{ background: #18181b; border-radius: 16px; border: 1px solid #27272a; overflow: hidden; }}
    .header {{ background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 32px; text-align: center; }}
    .header h1 {{ color: #fff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }}
    .header .sub {{ color: rgba(255,255,255,0.8); font-size: 14px; margin-top: 8px; }}
    .content {{ padding: 32px; }}
    .content h2 {{ color: #fff; font-size: 20px; margin-bottom: 12px; }}
    .content p {{ color: #a1a1aa; font-size: 15px; line-height: 1.6; margin-bottom: 16px; }}
    .content .highlight {{ color: #a78bfa; font-weight: 600; }}
    .features {{ display: flex; flex-direction: column; gap: 12px; margin: 24px 0; }}
    .feature {{ display: flex; align-items: flex-start; gap: 12px; }}
    .feature-icon {{ width: 20px; height: 20px; background: #7c3aed; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }}
    .feature-icon svg {{ width: 12px; height: 12px; fill: #fff; }}
    .feature-text {{ color: #d4d4d8; font-size: 14px; line-height: 1.5; }}
    .btn {{ display: inline-block; background: #7c3aed; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; margin: 24px 0; }}
    .btn:hover {{ background: #6d28d9; }}
    .footer {{ text-align: center; padding: 24px; color: #52525b; font-size: 12px; }}
    .footer a {{ color: #a78bfa; text-decoration: none; }}
    .divider {{ height: 1px; background: #27272a; margin: 24px 0; }}
    .logo {{ font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #fff; }}
    .logo span {{ color: #8b5cf6; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">STREAM<span>X</span></div>
        <h1>Welcome aboard! 🎉</h1>
        <p class="sub">Start watching instantly</p>
      </div>
      <div class="content">
        <h2>Hi {username},</h2>
        <p>
          Welcome to <span class="highlight">StreamX</span>! Your account has been
          created and you now have unlimited access to thousands of movies and TV
          shows from your personal media library — completely free.
        </p>

        <div class="features">
          <div class="feature">
            <div class="feature-icon">✓</div>
            <div class="feature-text"><strong>Unlimited Streaming</strong> — Watch any movie or show, any time.</div>
          </div>
          <div class="feature">
            <div class="feature-icon">✓</div>
            <div class="feature-text"><strong>All Devices</strong> — Continue watching on TV, phone, or tablet.</div>
          </div>
          <div class="feature">
            <div class="feature-icon">✓</div>
            <div class="feature-text"><strong>No Ads</strong> — Pure entertainment, no interruptions.</div>
          </div>
          <div class="feature">
            <div class="feature-icon">✓</div>
            <div class="feature-text"><strong>4K &amp; HDR</strong> — Stunning picture quality on supported titles.</div>
          </div>
        </div>

        <center>
          <a href="{app_url}/browse" class="btn">Start Watching Now →</a>
        </center>

        <div class="divider"></div>

        <p style="font-size: 13px; color: #71717a;">
          StreamX is completely free. Enjoy unlimited access to your personal media library!
        </p>
      </div>
    </div>
    <div class="footer">
      <p>© 2026 StreamX. All rights reserved.</p>
      <p style="margin-top: 4px;">
        Sent by <a href="mailto:{from_email}">{from_email}</a>
      </p>
    </div>
  </div>
</body>
</html>
"""

RESET_PASSWORD_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #09090b; color: #e4e4e7; }}
    .container {{ max-width: 600px; margin: 0 auto; padding: 40px 20px; }}
    .card {{ background: #18181b; border-radius: 16px; border: 1px solid #27272a; overflow: hidden; }}
    .header {{ background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center; }}
    .header h1 {{ color: #fff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }}
    .header .sub {{ color: rgba(255,255,255,0.8); font-size: 14px; margin-top: 8px; }}
    .content {{ padding: 32px; }}
    .content h2 {{ color: #fff; font-size: 20px; margin-bottom: 12px; }}
    .content p {{ color: #a1a1aa; font-size: 15px; line-height: 1.6; margin-bottom: 16px; }}
    .btn {{ display: inline-block; background: #f59e0b; color: #000; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; margin: 24px 0; }}
    .btn:hover {{ background: #d97706; }}
    .footer {{ text-align: center; padding: 24px; color: #52525b; font-size: 12px; }}
    .footer a {{ color: #fbbf24; text-decoration: none; }}
    .divider {{ height: 1px; background: #27272a; margin: 24px 0; }}
    .logo {{ font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #fff; }}
    .logo span {{ color: #8b5cf6; }}
    .warning {{ background: #271a00; border: 1px solid #78350f; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #fdba74; margin: 16px 0; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">STREAM<span>X</span></div>
        <h1>Reset Your Password 🔐</h1>
        <p class="sub">We received a password reset request</p>
      </div>
      <div class="content">
        <h2>Hi {username},</h2>
        <p>
          We received a request to reset the password for your
          <span class="highlight">StreamX</span> account. Click the button below
          to set a new password:
        </p>

        <center>
          <a href="{reset_link}" class="btn">Reset Password →</a>
        </center>

        <div class="warning">
          <strong>⏰ This link expires in 1 hour.</strong> If you didn't request a
          password reset, you can safely ignore this email — your account is secure.
        </div>

        <div class="divider"></div>

        <p style="font-size: 13px; color: #71717a;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="font-size: 12px; color: #a78bfa; word-break: break-all; margin-top: 4px;">
          {reset_link}
        </p>
      </div>
    </div>
    <div class="footer">
      <p>© 2026 StreamX. All rights reserved.</p>
      <p style="margin-top: 4px;">
        Sent by <a href="mailto:{from_email}">{from_email}</a>
      </p>
    </div>
  </div>
</body>
</html>
"""


# ── Sending ───────────────────────────────────────────────────────────────────

def _send_email(to_email: str, subject: str, html: str) -> bool:
    """Send an HTML email via Gmail SMTP. Returns True on success, False on failure."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping email to %s", to_email)
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = subject

        part = MIMEText(html, "html")
        msg.attach(part)

        # Strip spaces from password — Gmail App Passwords are often copied
        # in the display format "xxxx xxxx xxxx xxxx" but the actual credential
        # is the 16 characters without spaces.
        password = settings.SMTP_PASSWORD.replace(' ', '')
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, password)
            server.send_message(msg)

        logger.info("Email sent successfully to %s — subject=%s", to_email, subject)
        return True
    except smtplib.SMTPAuthenticationError:
        logger.error(
            "SMTP authentication failed for %s. Make sure you're using an App Password "
            "(not your regular Gmail password). Generate one at: "
            "https://myaccount.google.com/apppasswords",
            settings.SMTP_USER,
        )
        return False
    except smtplib.SMTPException as exc:
        logger.error("SMTP error sending to %s: %s", to_email, exc)
        return False
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc)
        return False


# ── Public API ────────────────────────────────────────────────────────────────

def send_welcome_email(to_email: str, username: str) -> bool:
    """Send a welcome email to a newly registered user."""
    subject = "Welcome to StreamX — Start Watching! 🎉"
    html = WELCOME_TEMPLATE.format(
        username=username,
        app_url=settings.APP_URL,
        from_email=settings.SMTP_FROM_EMAIL,
    )
    return _send_email(to_email, subject, html)


def send_password_reset_email(to_email: str, username: str, reset_token: str) -> bool:
    """Send a password reset email with a secure one-time link."""
    reset_link = f"{settings.APP_URL}/reset-password?token={reset_token}"
    subject = "Reset Your StreamX Password 🔐"
    html = RESET_PASSWORD_TEMPLATE.format(
        username=username,
        reset_link=reset_link,
        from_email=settings.SMTP_FROM_EMAIL,
    )
    return _send_email(to_email, subject, html)
