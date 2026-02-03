from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from .views import (
    AnalyticsSummaryView,
    AuditLogView,
    DesignTopicViewSet,
    DSAProblemViewSet,
    DueReviewsView,
    GoogleAuthView,
    LogoutView,
    RegisterView,
    StudySessionViewSet,
)

router = DefaultRouter()
router.register(r"dsa/problems", DSAProblemViewSet, basename="dsa-problem")
router.register(r"design/topics", DesignTopicViewSet, basename="design-topic")
router.register(r"study/sessions", StudySessionViewSet, basename="study-session")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/token", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/token/verify", TokenVerifyView.as_view(), name="token_verify"),
    path("auth/register", RegisterView.as_view(), name="register"),
    path("auth/logout", LogoutView.as_view(), name="logout"),
    path("auth/google", GoogleAuthView.as_view(), name="google_auth"),
    path("reviews/due", DueReviewsView.as_view()),
    path("analytics/summary", AnalyticsSummaryView.as_view()),
    path("audit/log", AuditLogView.as_view()),
]
