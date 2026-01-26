"""
Django config package.

This imports the Celery app so that it's loaded when Django starts.
"""

# This will ensure the app is always imported when
# Django starts so that shared_task will use this app.
from .celery import app as celery_app

__all__ = ("celery_app",)
