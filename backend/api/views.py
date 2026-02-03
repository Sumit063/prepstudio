from __future__ import annotations

import os
import requests
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import signing
from django.http import HttpResponseRedirect
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .auth_utils import get_request_user
from .google_calendar import (
    build_auth_url,
    build_session_event,
    exchange_code_for_tokens,
    refresh_access_token,
    revoke_token,
)
from .models import (
    DesignTopic,
    DSAAttempt,
    DSAProblem,
    GoogleCalendarAccount,
    ReviewItem,
    StudySession,
    Tag,
)
from .serializers import (
    AuditEventSerializer,
    DesignTopicSerializer,
    DSAAttemptSerializer,
    DSAProblemSerializer,
    ReviewItemSerializer,
    StudySessionSerializer,
    UserRegistrationSerializer,
)


class DSAProblemViewSet(viewsets.ModelViewSet):
    serializer_class = DSAProblemSerializer

    def _get_owner(self):
        owner = get_request_user(self.request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        return owner

    def get_queryset(self):
        owner = self._get_owner()
        queryset = (
            DSAProblem.objects.filter(owner=owner)
            .prefetch_related("tags")
            .annotate(attempts_count=Count("attempts"))
        )

        search = self.request.query_params.get("search") or self.request.query_params.get("q")
        if search:
            queryset = queryset.filter(title__icontains=search)

        platform = self.request.query_params.get("platform")
        if platform:
            queryset = queryset.filter(platform=platform)

        diff_min = self.request.query_params.get("difficulty_min")
        if diff_min:
            queryset = queryset.filter(difficulty__gte=int(diff_min))

        diff_max = self.request.query_params.get("difficulty_max")
        if diff_max:
            queryset = queryset.filter(difficulty__lte=int(diff_max))

        tags_param = self.request.query_params.get("tags")
        if tags_param:
            tags = [tag.strip() for tag in tags_param.split(",") if tag.strip()]
            if tags:
                queryset = queryset.filter(tags__name__in=tags).distinct()

        return queryset.order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(owner=self._get_owner())

    @action(detail=True, methods=["get", "post"], url_path="attempts")
    def attempts(self, request, pk=None):
        problem = self.get_object()
        owner = self._get_owner()
        if request.method == "GET":
            attempts = problem.attempts.filter(owner=owner).order_by("-created_at")
            serializer = DSAAttemptSerializer(attempts, many=True)
            return Response(serializer.data)

        serializer = DSAAttemptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(problem=problem, owner=owner)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DesignTopicViewSet(viewsets.ModelViewSet):
    serializer_class = DesignTopicSerializer

    def _get_owner(self):
        owner = get_request_user(self.request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        return owner

    def get_queryset(self):
        owner = self._get_owner()
        queryset = DesignTopic.objects.filter(owner=owner).prefetch_related("tags")

        search = self.request.query_params.get("search") or self.request.query_params.get("q")
        if search:
            queryset = queryset.filter(title__icontains=search)

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)

        tags_param = self.request.query_params.get("tags")
        if tags_param:
            tags = [tag.strip() for tag in tags_param.split(",") if tag.strip()]
            if tags:
                queryset = queryset.filter(tags__name__in=tags).distinct()

        return queryset.order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(owner=self._get_owner())


class StudySessionViewSet(viewsets.ModelViewSet):
    serializer_class = StudySessionSerializer

    def get_queryset(self):
        owner = get_request_user(self.request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        return StudySession.objects.filter(owner=owner).order_by("-date")

    def perform_create(self, serializer):
        owner = get_request_user(self.request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        session = serializer.save(owner=owner)
        sync_flag = self.request.data.get("sync_to_calendar", True)
        if str(sync_flag).lower() in {"false", "0", "no"}:
            return

        account = GoogleCalendarAccount.objects.filter(owner=owner).first()
        if not account:
            session.calendar_error = "Google Calendar not connected."
            session.save(update_fields=["calendar_error"])
            return

        try:
            token = refresh_access_token(account)
            event_payload = build_session_event(
                session, start_time=self.request.data.get("start_time")
            )
            response = requests.post(
                f"https://www.googleapis.com/calendar/v3/calendars/{account.calendar_id}/events",
                headers={"Authorization": f"Bearer {token}"},
                json=event_payload,
                timeout=15,
            )
            response.raise_for_status()
            data = response.json()
            session.calendar_event_id = data.get("id", "")
            session.calendar_event_link = data.get("htmlLink", "")
            session.calendar_synced_at = timezone.now()
            session.calendar_error = ""
            session.save(
                update_fields=[
                    "calendar_event_id",
                    "calendar_event_link",
                    "calendar_synced_at",
                    "calendar_error",
                ]
            )
        except Exception as exc:
            session.calendar_error = str(exc)
            session.save(update_fields=["calendar_error"])


class ReviewItemViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewItemSerializer

    def _get_owner(self):
        owner = get_request_user(self.request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        return owner

    def get_queryset(self):
        owner = self._get_owner()
        return ReviewItem.objects.filter(owner=owner).order_by("-next_review_at")

    def perform_create(self, serializer):
        serializer.save(owner=self._get_owner())


class DueReviewsView(APIView):
    def get(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        days = int(request.query_params.get("days", 0))
        cutoff = timezone.now() + timedelta(days=days)
        items = (
            ReviewItem.objects.filter(owner=owner, next_review_at__lte=cutoff)
            .order_by("next_review_at")
        )
        serializer = ReviewItemSerializer(items, many=True)
        return Response(serializer.data)


class AnalyticsSummaryView(APIView):
    def get(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        days = int(request.query_params.get("days", 30))
        since = timezone.now() - timedelta(days=days)

        attempts = DSAAttempt.objects.filter(owner=owner, created_at__gte=since).select_related(
            "problem"
        )
        attempts_total = attempts.count()
        attempts_solved = attempts.filter(status=DSAAttempt.Status.SOLVED).count()

        avg_time_rows = (
            attempts.values("problem__difficulty")
            .annotate(avg_time=Avg("time_taken_minutes"))
            .order_by("problem__difficulty")
        )
        avg_time_by_difficulty = {str(i): 0 for i in range(1, 6)}
        for row in avg_time_rows:
            avg_time_by_difficulty[str(row["problem__difficulty"])] = round(row["avg_time"] or 0, 2)

        tag_counts = (
            Tag.objects.filter(owner=owner).annotate(
                count=Count(
                    "dsa_problems__attempts",
                    filter=Q(dsa_problems__attempts__created_at__gte=since),
                )
            )
            .filter(count__gt=0)
            .order_by("-count")
        )
        top_tags_by_attempts = [
            {"tag": tag.name, "count": tag.count} for tag in tag_counts[:5]
        ]

        design_counts = (
            DesignTopic.objects.filter(owner=owner, updated_at__gte=since)
            .values("category")
            .annotate(count=Count("id"))
            .order_by("category")
        )
        design_topics_by_category = [
            {"category": item["category"], "count": item["count"]}
            for item in design_counts
        ]

        activity_items = []
        for attempt in attempts.order_by("-created_at")[:5]:
            activity_items.append(
                {
                    "type": "attempt",
                    "title": attempt.problem.title,
                    "detail": f"{attempt.status.title()} in {attempt.time_taken_minutes}m",
                    "occurred_at": attempt.created_at.isoformat(),
                }
            )

        for topic in (
            DesignTopic.objects.filter(owner=owner, updated_at__gte=since)
            .order_by("-updated_at")[:5]
        ):
            activity_items.append(
                {
                    "type": "design",
                    "title": topic.title,
                    "detail": "Updated notes",
                    "occurred_at": topic.updated_at.isoformat(),
                }
            )

        for session in (
            StudySession.objects.filter(owner=owner, created_at__gte=since)
            .order_by("-created_at")[:5]
        ):
            activity_items.append(
                {
                    "type": "session",
                    "title": f"{session.focus_area} session",
                    "detail": f"{session.duration_minutes}m",
                    "occurred_at": session.created_at.isoformat(),
                }
            )

        activity_items.sort(key=lambda item: item["occurred_at"], reverse=True)

        payload = {
            "attempts_solved_count": attempts_solved,
            "attempts_total_count": attempts_total,
            "avg_time_by_difficulty": avg_time_by_difficulty,
            "top_tags_by_attempts": top_tags_by_attempts,
            "design_topics_by_category": design_topics_by_category,
            "recent_activity": activity_items[:10],
        }
        return Response(payload)


class AuditLogView(APIView):
    def post(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        serializer = AuditEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = serializer.save(owner=owner)
        return Response(AuditEventSerializer(event).data, status=status.HTTP_201_CREATED)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        payload = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
        }
        return Response(payload, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response({"detail": "Refresh token required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh)
            token.blacklist()
        except Exception:
            return Response({"detail": "Invalid refresh token."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Logged out."}, status=status.HTTP_205_RESET_CONTENT)


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        if not client_id:
            return Response(
                {"detail": "Google auth not configured."},
                status=status.HTTP_404_NOT_FOUND,
            )

        credential = request.data.get("credential") or request.data.get("id_token")
        if not credential:
            return Response({"detail": "Credential required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            idinfo = google_id_token.verify_oauth2_token(
                credential, google_requests.Request(), client_id
            )
        except Exception:
            return Response({"detail": "Invalid Google token."}, status=status.HTTP_400_BAD_REQUEST)

        email = idinfo.get("email", "")
        full_name = idinfo.get("name", "").strip()
        sub = idinfo.get("sub", "")

        username = email or f"google-{sub}" if sub else "google-user"
        User = get_user_model()
        user = None
        if email:
            user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.filter(username=username).first()
        if user is None:
            user = User.objects.create_user(username=username, email=email)
            user.set_unusable_password()
            if full_name:
                parts = full_name.split()
                user.first_name = parts[0]
                user.last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
            user.save()
        elif full_name and not user.first_name:
            parts = full_name.split()
            user.first_name = parts[0]
            user.last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
            user.save(update_fields=["first_name", "last_name"])

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "username": user.username,
                "email": user.email,
            }
        )


class CalendarStatusView(APIView):
    def get(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        account = GoogleCalendarAccount.objects.filter(owner=owner).first()
        if not account:
            return Response({"connected": False})
        return Response(
            {
                "connected": True,
                "email": account.email or owner.email,
                "calendar_id": account.calendar_id,
            }
        )


class CalendarConnectView(APIView):
    def get(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        try:
            auth_url = build_auth_url(owner)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"auth_url": auth_url})


class CalendarDisconnectView(APIView):
    def post(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        account = GoogleCalendarAccount.objects.filter(owner=owner).first()
        if not account:
            return Response({"detail": "Calendar not connected."})
        token = account.refresh_token or account.access_token
        revoke_token(token)
        account.delete()
        return Response({"detail": "Disconnected."})


class CalendarCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
        redirect_url = f"{frontend_base}/sessions"

        error = request.query_params.get("error")
        if error:
            return HttpResponseRedirect(f"{redirect_url}?calendar=error")

        code = request.query_params.get("code")
        state = request.query_params.get("state")
        if not code or not state:
            return HttpResponseRedirect(f"{redirect_url}?calendar=error")

        try:
            payload = signing.loads(state, salt="google-calendar-state", max_age=600)
        except signing.BadSignature:
            return HttpResponseRedirect(f"{redirect_url}?calendar=error")

        user_id = payload.get("user_id")
        user = get_user_model().objects.filter(id=user_id).first()
        if not user:
            return HttpResponseRedirect(f"{redirect_url}?calendar=error")

        try:
            token_data = exchange_code_for_tokens(code)
        except Exception:
            return HttpResponseRedirect(f"{redirect_url}?calendar=error")

        refresh_token = token_data.get("refresh_token")
        access_token = token_data.get("access_token", "")
        scope = token_data.get("scope", "")
        expires_in = int(token_data.get("expires_in", 0))
        expiry = timezone.now() + timedelta(seconds=expires_in)

        account = GoogleCalendarAccount.objects.filter(owner=user).first()
        if account is None:
            if not refresh_token:
                return HttpResponseRedirect(f"{redirect_url}?calendar=error")
            account = GoogleCalendarAccount.objects.create(
                owner=user,
                refresh_token=refresh_token,
                access_token=access_token,
                token_expiry=expiry,
                scope=scope,
                email=user.email or "",
            )
        else:
            if refresh_token:
                account.refresh_token = refresh_token
            account.access_token = access_token or account.access_token
            account.token_expiry = expiry
            account.scope = scope or account.scope
            account.email = account.email or user.email or ""
            account.save(
                update_fields=["refresh_token", "access_token", "token_expiry", "scope", "email", "updated_at"]
            )

        return HttpResponseRedirect(f"{redirect_url}?calendar=connected")
