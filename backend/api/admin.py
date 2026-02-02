from django.contrib import admin

from .models import (
    AuditEvent,
    DesignTopic,
    DSAAttempt,
    DSAProblem,
    ReviewItem,
    StudySession,
    Tag,
)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    search_fields = ("name",)


@admin.register(DSAProblem)
class DSAProblemAdmin(admin.ModelAdmin):
    list_display = ("title", "platform", "difficulty", "updated_at")
    list_filter = ("platform", "difficulty")
    search_fields = ("title",)
    filter_horizontal = ("tags",)


@admin.register(DSAAttempt)
class DSAAttemptAdmin(admin.ModelAdmin):
    list_display = ("problem", "status", "time_taken_minutes", "created_at")
    list_filter = ("status",)
    search_fields = ("problem__title",)


@admin.register(DesignTopic)
class DesignTopicAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "updated_at")
    list_filter = ("category",)
    search_fields = ("title",)
    filter_horizontal = ("tags",)


@admin.register(StudySession)
class StudySessionAdmin(admin.ModelAdmin):
    list_display = ("date", "duration_minutes", "focus_area")
    list_filter = ("focus_area",)


@admin.register(ReviewItem)
class ReviewItemAdmin(admin.ModelAdmin):
    list_display = ("item_type", "ref_id", "next_review_at", "interval_days")
    list_filter = ("item_type",)


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ("source", "tool_name", "status", "created_at")
    list_filter = ("source", "status")
    search_fields = ("tool_name",)
