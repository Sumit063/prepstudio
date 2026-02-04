from __future__ import annotations

from typing import Iterable

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .auth_utils import get_request_user
from .models import (
    AuditEvent,
    DesignTopic,
    DSAAttempt,
    DSAProblem,
    ReviewItem,
    StudySession,
    Tag,
)


class TagListField(serializers.ListField):
    child = serializers.CharField()

    def to_representation(self, value: Iterable[Tag]) -> list[str]:
        if hasattr(value, "all"):
            return [tag.name for tag in value.all()]
        return [tag.name for tag in value]

    def to_internal_value(self, data):
        if data in (None, ""):
            return []
        return super().to_internal_value(data)


class DSAProblemSerializer(serializers.ModelSerializer):
    tags = TagListField(required=False)
    attempts_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = DSAProblem
        fields = [
            "id",
            "title",
            "platform",
            "link",
            "difficulty",
            "tags",
            "statement",
            "solution_notes",
            "workspace_notes",
            "approaches_json",
            "bucket_labels",
            "is_important",
            "is_done",
            "attempts_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "attempts_count"]

    def create(self, validated_data):
        tags = validated_data.pop("tags", [])
        instance = super().create(validated_data)
        self._sync_tags(instance, tags)
        return instance

    def update(self, instance, validated_data):
        tags = validated_data.pop("tags", None)
        instance = super().update(instance, validated_data)
        if tags is not None:
            self._sync_tags(instance, tags)
        return instance

    def _sync_tags(self, instance: DSAProblem, tags: list[str]) -> None:
        request = self.context.get("request") if hasattr(self, "context") else None
        owner = get_request_user(request) if request else None
        if owner is None:
            raise serializers.ValidationError("Authenticated user required for tags.")
        normalized = [tag.strip() for tag in tags if tag.strip()]
        tag_objs = [
            Tag.objects.get_or_create(owner=owner, name=name)[0] for name in normalized
        ]
        instance.tags.set(tag_objs)


class DSAAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = DSAAttempt
        fields = [
            "id",
            "problem",
            "status",
            "time_taken_minutes",
            "mistakes",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {"problem": {"required": False}}


class DesignTopicSerializer(serializers.ModelSerializer):
    tags = TagListField(required=False)

    class Meta:
        model = DesignTopic
        fields = [
            "id",
            "title",
            "category",
            "tags",
            "notes_markdown",
            "tradeoffs",
            "references_json",
            "bucket_labels",
            "is_important",
            "is_done",
            "canvas_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def create(self, validated_data):
        tags = validated_data.pop("tags", [])
        instance = super().create(validated_data)
        self._sync_tags(instance, tags)
        return instance

    def update(self, instance, validated_data):
        tags = validated_data.pop("tags", None)
        instance = super().update(instance, validated_data)
        if tags is not None:
            self._sync_tags(instance, tags)
        return instance

    def _sync_tags(self, instance: DesignTopic, tags: list[str]) -> None:
        request = self.context.get("request") if hasattr(self, "context") else None
        owner = get_request_user(request) if request else None
        if owner is None:
            raise serializers.ValidationError("Authenticated user required for tags.")
        normalized = [tag.strip() for tag in tags if tag.strip()]
        tag_objs = [
            Tag.objects.get_or_create(owner=owner, name=name)[0] for name in normalized
        ]
        instance.tags.set(tag_objs)


class StudySessionSerializer(serializers.ModelSerializer):
    sync_to_calendar = serializers.BooleanField(write_only=True, required=False)
    time_zone = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = StudySession
        fields = [
            "id",
            "date",
            "start_time",
            "duration_minutes",
            "focus_area",
            "notes",
            "sync_to_calendar",
            "time_zone",
            "calendar_event_id",
            "calendar_event_link",
            "calendar_error",
            "calendar_synced_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "calendar_event_id",
            "calendar_event_link",
            "calendar_error",
            "calendar_synced_at",
            "created_at",
        ]

    def create(self, validated_data):
        validated_data.pop("sync_to_calendar", None)
        validated_data.pop("time_zone", None)
        return super().create(validated_data)


class ReviewItemSerializer(serializers.ModelSerializer):
    sync_to_calendar = serializers.BooleanField(write_only=True, required=False)
    time_zone = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = ReviewItem
        fields = [
            "id",
            "item_type",
            "ref_id",
            "next_review_at",
            "interval_days",
            "sync_to_calendar",
            "time_zone",
            "calendar_event_id",
            "calendar_event_link",
            "calendar_error",
            "calendar_synced_at",
        ]
        read_only_fields = [
            "calendar_event_id",
            "calendar_event_link",
            "calendar_error",
            "calendar_synced_at",
        ]

    def create(self, validated_data):
        validated_data.pop("sync_to_calendar", None)
        validated_data.pop("time_zone", None)
        return super().create(validated_data)


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "source",
            "tool_name",
            "input_summary",
            "status",
            "error_message",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class UserRegistrationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=False, allow_blank=True)

    def validate_username(self, value: str) -> str:
        User = get_user_model()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data):
        User = get_user_model()
        return User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            email=validated_data.get("email", ""),
        )
