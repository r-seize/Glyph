import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
import httpx
from app.config import settings


def _send_smtp(to: str, subject: str, html: str) -> bool:
    msg             = MIMEMultipart("alternative")
    msg["Subject"]  = subject
    msg["From"]     = settings.email_from or settings.smtp_user
    msg["To"]       = to
    msg.attach(MIMEText(html, "html"))
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.ehlo()
            if settings.smtp_port != 465:
                server.starttls(context=ctx)
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(msg["From"], to, msg.as_string())
        return True
    except Exception as e:
        print(f"[email/smtp] error: {e}")
        return False


def _send_sendgrid(to: str, subject: str, html: str) -> bool:
    try:
        resp = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
            json={
                "personalizations": [{"to": [{"email": to}]}],
                "from": {"email": settings.email_from or "noreply@glyph.app"},
                "subject": subject,
                "content": [{"type": "text/html", "value": html}],
            },
            timeout=10,
        )
        return resp.status_code in (200, 202)
    except Exception as e:
        print(f"[email/sendgrid] error: {e}")
        return False


def _send_mailgun(to: str, subject: str, html: str) -> bool:
    try:
        resp = httpx.post(
            f"https://api.mailgun.net/v3/{settings.mailgun_domain}/messages",
            auth=("api", settings.mailgun_api_key),
            data={
                "from": settings.email_from or f"noreply@{settings.mailgun_domain}",
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=10,
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"[email/mailgun] error: {e}")
        return False


def _send_resend(to: str, subject: str, html: str) -> bool:
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from or "noreply@glyph.app",
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=10,
        )
        return resp.status_code in (200, 201)
    except Exception as e:
        print(f"[email/resend] error: {e}")
        return False


def is_configured() -> bool:
    return bool(
        settings.resend_api_key
        or settings.sendgrid_api_key
        or (settings.mailgun_api_key and settings.mailgun_domain)
        or settings.smtp_host
    )


def send_email(to: str, subject: str, html: str) -> bool:
    if settings.resend_api_key:
        return _send_resend(to, subject, html)
    if settings.sendgrid_api_key:
        return _send_sendgrid(to, subject, html)
    if settings.mailgun_api_key and settings.mailgun_domain:
        return _send_mailgun(to, subject, html)
    if settings.smtp_host:
        return _send_smtp(to, subject, html)
    print("[email] No email provider configured - skipping send")
    return False


def send_invite_email(to: str, workspace_name: str, invite_url: str, role: str) -> bool:
    subject     = f"Invitation to join {workspace_name} on Glyph"
    html        = f"""
    <div style  = "font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
      <div style="margin-bottom:24px">
        <span style  = "background:#374375;color:white;font-weight:700;font-size:18px;padding:6px 14px;border-radius:8px">G</span>
        <span style  = "font-size:18px;font-weight:600;margin-left:10px;color:#111">Glyph</span>
      </div>
      <h2 style  = "color:#111;margin-bottom:8px">You have been invited!</h2>
      <p style   = "color:#555;margin-bottom:24px">
        You have been invited to join the workspace <strong>{workspace_name}</strong>
        as a <strong>{role}</strong>.
      </p>
      <a href="{invite_url}"
         style="background:#374375;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
        Join the workspace
      </a>
      <p style="color:#999;font-size:12px;margin-top:32px">
        This link expires in 7 days. If you do not know the sender, please ignore this email.
      </p>
    </div>
    """
    return send_email(to, subject, html)
