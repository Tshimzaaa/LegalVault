from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "legalhub",
    broker=settings.REDIS_URL,
    include=["app.tasks.reminders"],
)

celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "matter-due-date-reminders": {
            "task": "app.tasks.reminders.send_matter_due_date_reminders",
            "schedule": crontab(hour=7, minute=0),
        },
        "contract-expiry-reminders": {
            "task": "app.tasks.reminders.send_contract_expiry_reminders",
            "schedule": crontab(hour=7, minute=15),
        },
    },
)
