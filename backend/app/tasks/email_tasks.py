from app.celery_app import celery_app


@celery_app.task(queue="processing", ignore_result=True)
def send_share_email(
  recipient_email: str,
  shared_by_name: str,
  item_type: str,
  item_title: str,
  permission: str,
) -> None:
  from app.services.email_service import email_service

  email_service.send_share_notification(
    recipient_email, shared_by_name, item_type, item_title, permission
  )
