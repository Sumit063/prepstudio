import os
from typing import Optional

from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta


def _get_service_token_from_request(request) -> str | None:
    return (
        request.headers.get("X-Service-Token")
        or request.headers.get("Service-Token")
        or request.headers.get("SERVICE_TOKEN")
    )


def get_service_user(request) -> Optional[object]:
    service_token = os.getenv("SERVICE_TOKEN", "")
    header_token = _get_service_token_from_request(request)
    if not service_token or not header_token or header_token != service_token:
        return None

    username = request.headers.get("X-Acting-User")
    User = get_user_model()
    if username:
        return User.objects.filter(username=username).first()

    demo_username = os.getenv("DEMO_USERNAME", "demo")
    demo_email = os.getenv("DEMO_EMAIL", "demo@prepstudio.local")
    user, _ = User.objects.get_or_create(username=demo_username, defaults={"email": demo_email})
    if not user.is_active:
        user.is_active = True
        user.save(update_fields=["is_active"])
    return user


def get_request_user(request) -> Optional[object]:
    user = getattr(request, "user", None)
    if user and getattr(user, "is_authenticated", False):
        now = timezone.now()
        last_active = user.last_login
        if not last_active or now - last_active > timedelta(minutes=5):
            user.last_login = now
            user.save(update_fields=["last_login"])
        return user
    return get_service_user(request)
