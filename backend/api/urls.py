from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from .views import (
    AnalyticsSummaryView,
    AuditLogView,
    CalendarCallbackView,
    CalendarConnectView,
    CalendarDisconnectView,
    CalendarStatusView,
    DesignTopicViewSet,
    DSAProblemViewSet,
    DueReviewsView,
    GoogleAuthView,
    LogoutView,
    RegisterView,
    ReviewItemViewSet,
    StudySessionViewSet,
)

router = DefaultRouter()
router.register(r"dsa/problems", DSAProblemViewSet, basename="dsa-problem")
router.register(r"design/topics", DesignTopicViewSet, basename="design-topic")
router.register(r"study/sessions", StudySessionViewSet, basename="study-session")
router.register(r"reviews", ReviewItemViewSet, basename="review-item")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/token", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/token/verify", TokenVerifyView.as_view(), name="token_verify"),
    path("auth/register", RegisterView.as_view(), name="register"),
    path("auth/logout", LogoutView.as_view(), name="logout"),
    path("auth/google", GoogleAuthView.as_view(), name="google_auth"),
    path("calendar/status", CalendarStatusView.as_view(), name="calendar_status"),
    path("calendar/connect", CalendarConnectView.as_view(), name="calendar_connect"),
    path("calendar/disconnect", CalendarDisconnectView.as_view(), name="calendar_disconnect"),
    path("calendar/oauth/callback", CalendarCallbackView.as_view(), name="calendar_callback"),
    path("reviews/due", DueReviewsView.as_view()),
    path("analytics/summary", AnalyticsSummaryView.as_view()),
    path("audit/log", AuditLogView.as_view()),
]
