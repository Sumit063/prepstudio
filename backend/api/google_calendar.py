from __future__ import annotations

import os
from datetime import datetime, time, timedelta
from typing import Optional
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.core import signing
from django.utils import timezone

from .models import GoogleCalendarAccount, StudySession

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
DEFAULT_SCOPES = "https://www.googleapis.com/auth/calendar.events"


def _get_oauth_config() -> tuple[str, str, str, str]:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    redirect_uri = os.getenv("GOOGLE_OAUTH_REDIRECT_URI", "")
    scopes = os.getenv("GOOGLE_CALENDAR_SCOPES", DEFAULT_SCOPES) or DEFAULT_SCOPES
    return client_id, client_secret, redirect_uri, scopes


def build_auth_url(user) -> str:
    client_id, _, redirect_uri, scopes = _get_oauth_config()
    if not client_id or not redirect_uri:
        raise ValueError("Google OAuth is not configured.")

    state = signing.dumps({"user_id": user.id}, salt="google-calendar-state")
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scopes,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code_for_tokens(code: str) -> dict:
    client_id, client_secret, redirect_uri, _ = _get_oauth_config()
    if not client_id or not client_secret or not redirect_uri:
        raise ValueError("Google OAuth is not configured.")

    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def refresh_access_token(account: GoogleCalendarAccount) -> str:
    if account.access_token and account.token_expiry:
        if account.token_expiry > timezone.now() + timedelta(seconds=60):
            return account.access_token

    client_id, client_secret, _, _ = _get_oauth_config()
    if not client_id or not client_secret:
        raise ValueError("Google OAuth is not configured.")

    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": account.refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=15,
    )
    response.raise_for_status()
    payload = response.json()
    account.access_token = payload.get("access_token", "")
    expires_in = int(payload.get("expires_in", 0))
    account.token_expiry = timezone.now() + timedelta(seconds=expires_in)
    account.save(update_fields=["access_token", "token_expiry", "updated_at"])
    return account.access_token


def revoke_token(token: str) -> None:
    if not token:
        return
    try:
        requests.post(GOOGLE_REVOKE_URL, params={"token": token}, timeout=10)
    except requests.RequestException:
        return


def build_session_event(session: StudySession, start_time: Optional[str] = None) -> dict:
    session_date = session.date
    default_time = time(9, 0)
    if start_time:
        try:
            parts = [int(part) for part in start_time.split(":")]
            default_time = time(parts[0], parts[1] if len(parts) > 1 else 0)
        except (ValueError, IndexError):
            default_time = time(9, 0)

    start_dt = datetime.combine(session_date, default_time)
    tz = timezone.get_current_timezone()
    start_dt = timezone.make_aware(start_dt, tz)
    end_dt = start_dt + timedelta(minutes=session.duration_minutes or 60)

    description_parts = []
    if session.notes:
        description_parts.append(session.notes)
    description_parts.append("Created by PrepStudio")

    return {
        "summary": f"PrepStudio {session.focus_area} session",
        "description": "\n\n".join(description_parts),
        "start": {
            "dateTime": start_dt.isoformat(),
            "timeZone": settings.TIME_ZONE,
        },
        "end": {
            "dateTime": end_dt.isoformat(),
            "timeZone": settings.TIME_ZONE,
        },
    }
