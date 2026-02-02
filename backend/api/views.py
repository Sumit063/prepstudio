from __future__ import annotations

from datetime import timedelta

from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DesignTopic, DSAAttempt, DSAProblem, ReviewItem, StudySession, Tag
from .serializers import (
    AuditEventSerializer,
    DesignTopicSerializer,
    DSAAttemptSerializer,
    DSAProblemSerializer,
    ReviewItemSerializer,
    StudySessionSerializer,
)


class DSAProblemViewSet(viewsets.ModelViewSet):
    serializer_class = DSAProblemSerializer

    def get_queryset(self):
        queryset = (
            DSAProblem.objects.all()
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

    @action(detail=True, methods=["get", "post"], url_path="attempts")
    def attempts(self, request, pk=None):
        problem = self.get_object()
        if request.method == "GET":
            attempts = problem.attempts.all().order_by("-created_at")
            serializer = DSAAttemptSerializer(attempts, many=True)
            return Response(serializer.data)

        serializer = DSAAttemptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(problem=problem)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class DesignTopicViewSet(viewsets.ModelViewSet):
    serializer_class = DesignTopicSerializer

    def get_queryset(self):
        queryset = DesignTopic.objects.all().prefetch_related("tags")

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


class StudySessionViewSet(viewsets.ModelViewSet):
    serializer_class = StudySessionSerializer

    def get_queryset(self):
        return StudySession.objects.all().order_by("-date")


class DueReviewsView(APIView):
    def get(self, request):
        days = int(request.query_params.get("days", 0))
        cutoff = timezone.now() + timedelta(days=days)
        items = ReviewItem.objects.filter(next_review_at__lte=cutoff).order_by("next_review_at")
        serializer = ReviewItemSerializer(items, many=True)
        return Response(serializer.data)


class AnalyticsSummaryView(APIView):
    def get(self, request):
        days = int(request.query_params.get("days", 30))
        since = timezone.now() - timedelta(days=days)

        attempts = DSAAttempt.objects.filter(created_at__gte=since).select_related("problem")
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
            Tag.objects.annotate(count=Count("dsa_problems__attempts", filter=Q(dsa_problems__attempts__created_at__gte=since)))
            .filter(count__gt=0)
            .order_by("-count")
        )
        top_tags_by_attempts = [
            {"tag": tag.name, "count": tag.count} for tag in tag_counts[:5]
        ]

        design_counts = (
            DesignTopic.objects.filter(updated_at__gte=since)
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

        for topic in DesignTopic.objects.filter(updated_at__gte=since).order_by("-updated_at")[:5]:
            activity_items.append(
                {
                    "type": "design",
                    "title": topic.title,
                    "detail": "Updated notes",
                    "occurred_at": topic.updated_at.isoformat(),
                }
            )

        for session in StudySession.objects.filter(created_at__gte=since).order_by("-created_at")[:5]:
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
        serializer = AuditEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = serializer.save()
        return Response(AuditEventSerializer(event).data, status=status.HTTP_201_CREATED)
