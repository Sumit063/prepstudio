from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from .views import (
    AnalyticsSummaryView,
    AuditLogView,
    BuddyAcceptView,
    BuddyListView,
    BuddyRemoveView,
    BuddyRequestView,
    BuddySearchView,
    CalendarCallbackView,
    CalendarConnectView,
    CalendarDisconnectView,
    CalendarStatusView,
    DesignTopicViewSet,
    DSAProblemViewSet,
    DueReviewsView,
    GoogleAuthView,
    LogoutView,
    MergedDesignListView,
    MergedDsaListView,
    MergedProblemDetailView,
    MergedTopicDetailView,
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
    path("buddies", BuddyListView.as_view(), name="buddy_list"),
    path("buddies/search", BuddySearchView.as_view(), name="buddy_search"),
    path("buddies/request", BuddyRequestView.as_view(), name="buddy_request"),
    path("buddies/accept", BuddyAcceptView.as_view(), name="buddy_accept"),
    path("buddies/remove", BuddyRemoveView.as_view(), name="buddy_remove"),
    path("merged/dsa/problems", MergedDsaListView.as_view(), name="merged_dsa_list"),
    path("merged/design/topics", MergedDesignListView.as_view(), name="merged_design_list"),
    path("merged/problems/<int:problem_id>", MergedProblemDetailView.as_view(), name="merged_problem_detail"),
    path("merged/topics/<int:topic_id>", MergedTopicDetailView.as_view(), name="merged_topic_detail"),
    path("calendar/status", CalendarStatusView.as_view(), name="calendar_status"),
    path("calendar/connect", CalendarConnectView.as_view(), name="calendar_connect"),
    path("calendar/disconnect", CalendarDisconnectView.as_view(), name="calendar_disconnect"),
    path("calendar/oauth/callback", CalendarCallbackView.as_view(), name="calendar_callback"),
    path("reviews/due", DueReviewsView.as_view()),
    path("analytics/summary", AnalyticsSummaryView.as_view()),
    path("audit/log", AuditLogView.as_view()),
]
