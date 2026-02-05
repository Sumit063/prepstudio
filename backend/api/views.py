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
from .global_dsa import (
    create_global_problems_for_all_users,
    derive_global_key,
    ensure_global_problems_for_user,
    update_global_problems,
)
from .global_design import (
    create_global_topics_for_all_users,
    derive_global_key as derive_design_global_key,
    ensure_global_topics_for_user,
    update_global_topics,
)
from .global_custom import ensure_global_custom_for_user
from .google_calendar import (
    build_auth_url,
    build_review_event,
    build_session_event,
    exchange_code_for_tokens,
    refresh_access_token,
    revoke_token,
)
from .models import (
    CustomQuestion,
    CustomSection,
    CustomSubsection,
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
    CustomQuestionSerializer,
    CustomSectionSerializer,
    CustomSubsectionSerializer,
    DesignTopicSerializer,
    DSAAttemptSerializer,
    DSAProblemSerializer,
    ReviewItemSerializer,
    StudySessionSerializer,
    UserRegistrationSerializer,
)
from .pagination import StandardResultsSetPagination
from .services.buddy_service import (
    accept_buddy,
    list_buddies,
    remove_buddy,
    request_buddy,
    search_users,
)
from .services.merge_service import (
    get_merged_design_list,
    get_merged_dsa_list,
    get_merged_custom_question_detail,
    get_merged_problem_detail,
    get_merged_topic_detail,
)

def _serialize_owner(user):
    name = f"{user.first_name} {user.last_name}".strip() or user.username
    last_active = user.last_login or user.date_joined
    return {
        "id": user.id,
        "name": name,
        "username": user.username,
        "avatarUrl": "",
        "last_active_at": last_active.isoformat() if last_active else None,
    }


def _serialize_problem(problem, viewer):
    data = DSAProblemSerializer(problem).data
    data["owner"] = _serialize_owner(problem.owner)
    data["is_owner"] = problem.owner_id == viewer.id
    return data


def _serialize_topic(topic, viewer):
    data = DesignTopicSerializer(topic).data
    data["owner"] = _serialize_owner(topic.owner)
    data["is_owner"] = topic.owner_id == viewer.id
    return data

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
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(tags__name__icontains=search)
            ).distinct()

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
            tags = [tag.strip().lower() for tag in tags_param.split(",") if tag.strip()]
            if tags:
                queryset = queryset.filter(tags__name__in=tags).distinct()

        return queryset.order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(owner=self._get_owner())

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        owner = self._get_owner()
        is_global = bool(request.data.get("is_global")) and owner.is_staff
        if is_global:
            base_data = {
                "title": serializer.validated_data.get("title"),
                "platform": serializer.validated_data.get("platform"),
                "link": serializer.validated_data.get("link"),
                "difficulty": serializer.validated_data.get("difficulty"),
                "bucket_labels": serializer.validated_data.get("bucket_labels", []),
            }
            tag_names = serializer.validated_data.get("tags", [])
            global_key = request.data.get("global_key") or derive_global_key(
                base_data["title"], base_data.get("link")
            )
            if DSAProblem.objects.filter(is_global=True, global_key=global_key).exists():
                return Response(
                    {"detail": "Global question already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            create_global_problems_for_all_users(base_data, tag_names, global_key)
            instance = DSAProblem.objects.filter(owner=owner, global_key=global_key).first()
            output = self.get_serializer(instance)
            return Response(output.data, status=status.HTTP_201_CREATED)

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        owner = self._get_owner()
        if instance.is_global and owner.is_staff:
            if not instance.global_key:
                return Response(
                    {"detail": "Global key missing for this question."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            base_updates = {}
            for field in ("title", "platform", "link", "difficulty", "bucket_labels"):
                if field in serializer.validated_data:
                    base_updates[field] = serializer.validated_data.pop(field)
            tag_names = serializer.validated_data.pop("tags", None)
            if serializer.validated_data:
                serializer.save()
            if base_updates or tag_names is not None:
                update_global_problems(instance.global_key, base_updates, tag_names)
            instance.refresh_from_db()
            output = self.get_serializer(instance)
            return Response(output.data)

        self.perform_update(serializer)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        owner = self._get_owner()
        if instance.is_global and not owner.is_staff:
            raise PermissionDenied("Global questions can only be deleted by an admin.")
        if instance.is_global and owner.is_staff:
            if not instance.global_key:
                return Response(
                    {"detail": "Global key missing for this question."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            DSAProblem.objects.filter(is_global=True, global_key=instance.global_key).delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)

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
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(tags__name__icontains=search)
            ).distinct()

        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)

        tags_param = self.request.query_params.get("tags")
        if tags_param:
            tags = [tag.strip().lower() for tag in tags_param.split(",") if tag.strip()]
            if tags:
                queryset = queryset.filter(tags__name__in=tags).distinct()

        return queryset.order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(owner=self._get_owner())

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        owner = self._get_owner()
        is_global = bool(request.data.get("is_global")) and owner.is_staff
        if is_global:
            base_data = {
                "title": serializer.validated_data.get("title"),
                "category": serializer.validated_data.get("category"),
                "references_json": serializer.validated_data.get("references_json", []),
                "bucket_labels": serializer.validated_data.get("bucket_labels", []),
            }
            tag_names = serializer.validated_data.get("tags", [])
            global_key = request.data.get("global_key") or derive_design_global_key(
                base_data["title"]
            )
            if DesignTopic.objects.filter(is_global=True, global_key=global_key).exists():
                return Response(
                    {"detail": "Global topic already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            create_global_topics_for_all_users(base_data, tag_names, global_key)
            instance = DesignTopic.objects.filter(owner=owner, global_key=global_key).first()
            output = self.get_serializer(instance)
            return Response(output.data, status=status.HTTP_201_CREATED)

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        owner = self._get_owner()
        if instance.is_global and owner.is_staff:
            if not instance.global_key:
                return Response(
                    {"detail": "Global key missing for this topic."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            base_updates = {}
            for field in ("title", "category", "references_json", "bucket_labels"):
                if field in serializer.validated_data:
                    base_updates[field] = serializer.validated_data.pop(field)
            tag_names = serializer.validated_data.pop("tags", None)
            if serializer.validated_data:
                serializer.save()
            if base_updates or tag_names is not None:
                update_global_topics(instance.global_key, base_updates, tag_names)
            instance.refresh_from_db()
            output = self.get_serializer(instance)
            return Response(output.data)

        self.perform_update(serializer)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        owner = self._get_owner()
        if instance.is_global and not owner.is_staff:
            raise PermissionDenied("Global topics can only be deleted by an admin.")
        if instance.is_global and owner.is_staff:
            if not instance.global_key:
                return Response(
                    {"detail": "Global key missing for this topic."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            DesignTopic.objects.filter(is_global=True, global_key=instance.global_key).delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)


class CustomSectionViewSet(viewsets.ModelViewSet):
    serializer_class = CustomSectionSerializer
    pagination_class = None

    def _get_owner(self):
        owner = get_request_user(self.request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        return owner

    def get_queryset(self):
        owner = self._get_owner()
        return CustomSection.objects.filter(owner=owner).order_by("title")

    def perform_create(self, serializer):
        serializer.save(owner=self._get_owner())

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        owner = self._get_owner()
        if instance.is_global and not owner.is_staff:
            raise PermissionDenied("Global sections can only be deleted by an admin.")
        if instance.is_global and owner.is_staff and instance.global_key:
            CustomSection.objects.filter(is_global=True, global_key=instance.global_key).delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)


class CustomSubsectionViewSet(viewsets.ModelViewSet):
    serializer_class = CustomSubsectionSerializer
    pagination_class = None

    def _get_owner(self):
        owner = get_request_user(self.request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        return owner

    def get_queryset(self):
        owner = self._get_owner()
        queryset = CustomSubsection.objects.filter(owner=owner)
        section_id = self.request.query_params.get("section")
        if section_id:
            queryset = queryset.filter(section_id=section_id)
        return queryset.order_by("title")

    def perform_create(self, serializer):
        serializer.save(owner=self._get_owner())

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        owner = self._get_owner()
        if instance.is_global and not owner.is_staff:
            raise PermissionDenied("Global subsections can only be deleted by an admin.")
        if instance.is_global and owner.is_staff and instance.global_key:
            CustomSubsection.objects.filter(is_global=True, global_key=instance.global_key).delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)


class CustomQuestionViewSet(viewsets.ModelViewSet):
    serializer_class = CustomQuestionSerializer
    pagination_class = None

    def _get_owner(self):
        owner = get_request_user(self.request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        return owner

    def get_queryset(self):
        owner = self._get_owner()
        queryset = CustomQuestion.objects.filter(owner=owner)
        section_id = self.request.query_params.get("section")
        if section_id:
            queryset = queryset.filter(subsection__section_id=section_id)
        subsection_id = self.request.query_params.get("subsection")
        if subsection_id:
            queryset = queryset.filter(subsection_id=subsection_id)
        return queryset.order_by("title")

    def perform_create(self, serializer):
        serializer.save(owner=self._get_owner())

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        owner = self._get_owner()
        if instance.is_global and not owner.is_staff:
            raise PermissionDenied("Global questions can only be deleted by an admin.")
        if instance.is_global and owner.is_staff and instance.global_key:
            CustomQuestion.objects.filter(is_global=True, global_key=instance.global_key).delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)


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
        tz_name = self.request.data.get("time_zone")
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
                session,
                start_time=self.request.data.get("start_time"),
                tz_name=tz_name,
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
        owner = self._get_owner()
        review = serializer.save(owner=owner)
        sync_flag = self.request.data.get("sync_to_calendar", True)
        tz_name = self.request.data.get("time_zone")
        if str(sync_flag).lower() in {"false", "0", "no"}:
            return

        account = GoogleCalendarAccount.objects.filter(owner=owner).first()
        if not account:
            review.calendar_error = "Google Calendar not connected."
            review.save(update_fields=["calendar_error"])
            return

        try:
            token = refresh_access_token(account)
            event_payload = build_review_event(review, tz_name=tz_name)
            response = requests.post(
                f"https://www.googleapis.com/calendar/v3/calendars/{account.calendar_id}/events",
                headers={"Authorization": f"Bearer {token}"},
                json=event_payload,
                timeout=15,
            )
            response.raise_for_status()
            data = response.json()
            review.calendar_event_id = data.get("id", "")
            review.calendar_event_link = data.get("htmlLink", "")
            review.calendar_synced_at = timezone.now()
            review.calendar_error = ""
            review.save(
                update_fields=[
                    "calendar_event_id",
                    "calendar_event_link",
                    "calendar_synced_at",
                    "calendar_error",
                ]
            )
        except Exception as exc:
            review.calendar_error = str(exc)
            review.save(update_fields=["calendar_error"])


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


class BuddyListView(APIView):
    def get(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        return Response({"relationships": list_buddies(owner)})


class BuddySearchView(APIView):
    def get(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        query = request.query_params.get("query", "")
        results = search_users(owner, query)
        return Response({"results": results})


class BuddyRequestView(APIView):
    def post(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        identifier = request.data.get("identifier", "") or request.data.get("email", "")
        if not identifier:
            return Response({"detail": "Identifier required."}, status=status.HTTP_400_BAD_REQUEST)
        relationship = request_buddy(owner, identifier)
        return Response(relationship, status=status.HTTP_201_CREATED)


class BuddyAcceptView(APIView):
    def post(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        relationship_id = request.data.get("relationship_id")
        if not relationship_id:
            return Response({"detail": "Relationship id required."}, status=status.HTTP_400_BAD_REQUEST)
        relationship = accept_buddy(owner, int(relationship_id))
        return Response(relationship)


class BuddyRemoveView(APIView):
    def post(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        relationship_id = request.data.get("relationship_id")
        if not relationship_id:
            return Response({"detail": "Relationship id required."}, status=status.HTTP_400_BAD_REQUEST)
        remove_buddy(owner, int(relationship_id))
        return Response({"detail": "Buddy removed."})


class MergedDsaListView(APIView):
    def get(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        items = get_merged_dsa_list(owner)

        search = request.query_params.get("search") or request.query_params.get("q")
        if search:
            search_lower = search.lower()
            items = [
                item
                for item in items
                if search_lower in item.title.lower()
                or any(search_lower in tag.name.lower() for tag in item.tags.all())
            ]

        diff_min = request.query_params.get("difficulty_min")
        diff_max = request.query_params.get("difficulty_max")
        if diff_min:
            items = [item for item in items if item.difficulty >= int(diff_min)]
        if diff_max:
            items = [item for item in items if item.difficulty <= int(diff_max)]

        tags_param = request.query_params.get("tags")
        if tags_param:
            tags = [tag.strip().lower() for tag in tags_param.split(",") if tag.strip()]
            if tags:
                items = [
                    item
                    for item in items
                    if any(tag.name.lower() in tags for tag in item.tags.all())
                ]

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(items, request)
        data = [_serialize_problem(item, owner) for item in page]
        return paginator.get_paginated_response(data)


class MergedDesignListView(APIView):
    def get(self, request):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        items = get_merged_design_list(owner)

        search = request.query_params.get("search") or request.query_params.get("q")
        if search:
            search_lower = search.lower()
            items = [
                item
                for item in items
                if search_lower in item.title.lower()
                or any(search_lower in tag.name.lower() for tag in item.tags.all())
            ]

        category = request.query_params.get("category")
        if category:
            items = [item for item in items if item.category == category]

        tags_param = request.query_params.get("tags")
        if tags_param:
            tags = [tag.strip().lower() for tag in tags_param.split(",") if tag.strip()]
            if tags:
                items = [
                    item
                    for item in items
                    if any(tag.name.lower() in tags for tag in item.tags.all())
                ]

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(items, request)
        data = [_serialize_topic(item, owner) for item in page]
        return paginator.get_paginated_response(data)


class MergedProblemDetailView(APIView):
    def get(self, request, problem_id: int):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        problem, entries = get_merged_problem_detail(owner, problem_id)
        payload = {
            "problem": _serialize_problem(problem, owner),
            "entries": [
                {
                    "id": entry.id,
                    "type": entry.type,
                    "content": entry.content,
                    "language": entry.language,
                    "createdAt": entry.created_at,
                    "owner": entry.owner,
                }
                for entry in entries
            ],
            "current_user_id": owner.id,
        }
        return Response(payload)


class MergedTopicDetailView(APIView):
    def get(self, request, topic_id: int):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        topic, entries = get_merged_topic_detail(owner, topic_id)
        payload = {
            "topic": _serialize_topic(topic, owner),
            "entries": [
                {
                    "id": entry.id,
                    "type": entry.type,
                    "content": entry.content,
                    "language": entry.language,
                    "createdAt": entry.created_at,
                    "owner": entry.owner,
                }
                for entry in entries
            ],
            "current_user_id": owner.id,
        }
        return Response(payload)


class MergedCustomQuestionDetailView(APIView):
    def get(self, request, question_id: int):
        owner = get_request_user(request)
        if owner is None:
            raise PermissionDenied("No active user scope.")
        question, entries = get_merged_custom_question_detail(owner, question_id)
        payload = {
            "question": CustomQuestionSerializer(question).data,
            "entries": [
                {
                    "id": entry.id,
                    "type": entry.type,
                    "content": entry.content,
                    "language": entry.language,
                    "createdAt": entry.created_at,
                    "owner": entry.owner,
                }
                for entry in entries
            ],
            "current_user_id": owner.id,
        }
        return Response(payload)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        ensure_global_problems_for_user(user)
        ensure_global_topics_for_user(user)
        ensure_global_custom_for_user(user)
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
            ensure_global_problems_for_user(user)
            ensure_global_topics_for_user(user)
            ensure_global_custom_for_user(user)
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
