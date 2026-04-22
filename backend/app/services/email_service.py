import resend

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


class EmailService:
  def send_share_notification(
    self,
    recipient_email: str,
    shared_by_name: str,
    item_type: str,
    item_title: str,
    permission: str,
  ) -> None:
    if not settings.EMAIL_ENABLED or not settings.RESEND_API_KEY:
      logger.info("Email disabled, skipping", to=recipient_email)
      return

    resend.api_key = settings.RESEND_API_KEY
    url = f"{settings.APP_URL}/papers" if item_type == "paper" else f"{settings.APP_URL}/groups"
    subject = f'{shared_by_name} shared a {item_type} with you: "{item_title}"'
    body = (
      f'{shared_by_name} shared the {item_type} "{item_title}" with you '
      f"as {permission}.\n\nView it here: {url}"
    )

    try:
      resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": [recipient_email],
        "subject": subject,
        "text": body,
      })
    except Exception as e:
      logger.error("Failed to send share email", error=str(e), to=recipient_email)


email_service = EmailService()
