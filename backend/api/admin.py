from django.contrib import admin

from .models import (
    AuditEvent,
    BuddyRelationship,
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


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "owner")
    search_fields = ("name", "owner__username")
    list_filter = ("owner",)


@admin.register(DSAProblem)
class DSAProblemAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "platform", "difficulty", "is_global", "global_key", "updated_at")
    list_filter = ("owner", "platform", "difficulty", "is_global")
    search_fields = ("title",)
    filter_horizontal = ("tags",)


@admin.register(DSAAttempt)
class DSAAttemptAdmin(admin.ModelAdmin):
    list_display = ("problem", "owner", "status", "time_taken_minutes", "created_at")
    list_filter = ("owner", "status")
    search_fields = ("problem__title", "owner__username")


@admin.register(DesignTopic)
class DesignTopicAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "category", "is_global", "global_key", "updated_at")
    list_filter = ("owner", "category", "is_global")
    search_fields = ("title",)
    filter_horizontal = ("tags",)


@admin.register(StudySession)
class StudySessionAdmin(admin.ModelAdmin):
    list_display = ("date", "owner", "duration_minutes", "focus_area")
    list_filter = ("owner", "focus_area")


@admin.register(ReviewItem)
class ReviewItemAdmin(admin.ModelAdmin):
    list_display = ("item_type", "owner", "ref_id", "next_review_at", "interval_days")
    list_filter = ("owner", "item_type")


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("source", "tool_name", "owner", "status", "created_at")
    list_filter = ("owner", "source", "status")
    search_fields = ("tool_name", "owner__username")


@admin.register(GoogleCalendarAccount)
class GoogleCalendarAccountAdmin(admin.ModelAdmin):
    list_display = ("owner", "email", "calendar_id", "updated_at")
    list_filter = ("calendar_id",)
    search_fields = ("owner__username", "email")


@admin.register(BuddyRelationship)
class BuddyRelationshipAdmin(admin.ModelAdmin):
    list_display = ("requester", "addressee", "status", "updated_at")
    list_filter = ("status",)
    search_fields = ("requester__username", "addressee__username")


@admin.register(CustomSection)
class CustomSectionAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "is_global", "global_key", "updated_at")
    list_filter = ("owner", "is_global")
    search_fields = ("title", "owner__username", "global_key")


@admin.register(CustomSubsection)
class CustomSubsectionAdmin(admin.ModelAdmin):
    list_display = ("title", "section", "owner", "is_global", "global_key", "updated_at")
    list_filter = ("owner", "is_global")
    search_fields = ("title", "section__title", "owner__username", "global_key")


@admin.register(CustomQuestion)
class CustomQuestionAdmin(admin.ModelAdmin):
    list_display = ("title", "section", "subsection", "owner", "is_global", "global_key", "updated_at")
    list_filter = ("owner", "section", "is_global")
    search_fields = ("title", "section__title", "owner__username", "global_key")
