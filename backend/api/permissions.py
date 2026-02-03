import os

from rest_framework.permissions import BasePermission


class ServiceTokenOrAuthenticated(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            return True

        service_token = os.getenv("SERVICE_TOKEN", "")
        if not service_token:
            return False

        header_token = (
            request.headers.get("X-Service-Token")
            or request.headers.get("Service-Token")
            or request.headers.get("SERVICE_TOKEN")
        )
        return bool(header_token and header_token == service_token)
