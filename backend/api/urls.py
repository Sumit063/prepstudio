from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AnalyticsSummaryView,
    AuditLogView,
    DesignTopicViewSet,
    DSAProblemViewSet,
    DueReviewsView,
    StudySessionViewSet,
)

router = DefaultRouter()
router.register(r"dsa/problems", DSAProblemViewSet, basename="dsa-problem")
router.register(r"design/topics", DesignTopicViewSet, basename="design-topic")
router.register(r"study/sessions", StudySessionViewSet, basename="study-session")

urlpatterns = [
    path("", include(router.urls)),
    path("reviews/due", DueReviewsView.as_view()),
    path("analytics/summary", AnalyticsSummaryView.as_view()),
    path("audit/log", AuditLogView.as_view()),
]
