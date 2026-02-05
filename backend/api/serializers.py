from __future__ import annotations

from typing import Iterable

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .auth_utils import get_request_user
from .models import (
    AuditEvent,
    CustomQuestion,
    CustomSection,
    CustomSubsection,
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
    is_global = serializers.BooleanField(read_only=True)
    global_key = serializers.CharField(read_only=True)
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
            "is_global",
            "global_key",
            "is_important",
            "is_done",
            "attempts_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "attempts_count", "is_global", "global_key"]

    def create(self, validated_data):
        bucket_labels = self._normalize_labels(validated_data.get("bucket_labels", []))
        validated_data["bucket_labels"] = bucket_labels
        tags = validated_data.pop("tags", [])
        merged_tags = self._merge_bucket_tags(bucket_labels, tags)
        instance = super().create(validated_data)
        self._sync_tags(instance, merged_tags)
        return instance

    def update(self, instance, validated_data):
        request = self.context.get("request") if hasattr(self, "context") else None
        is_staff = bool(getattr(getattr(request, "user", None), "is_staff", False))
        if instance.is_global and not is_staff:
            for field in ("title", "platform", "link", "difficulty", "bucket_labels", "tags"):
                validated_data.pop(field, None)

        tags = validated_data.pop("tags", None)
        bucket_labels_input = validated_data.get("bucket_labels", None)
        if bucket_labels_input is not None:
            bucket_labels = self._normalize_labels(bucket_labels_input)
            validated_data["bucket_labels"] = bucket_labels
        else:
            bucket_labels = list(instance.bucket_labels or [])
        instance = super().update(instance, validated_data)
        if tags is not None or bucket_labels_input is not None:
            existing_tags = [tag.name for tag in instance.tags.all()]
            merged_tags = self._merge_bucket_tags(
                bucket_labels,
                tags if tags is not None else existing_tags,
            )
            self._sync_tags(instance, merged_tags)
        return instance

    def _sync_tags(self, instance: DSAProblem, tags: list[str]) -> None:
        request = self.context.get("request") if hasattr(self, "context") else None
        owner = get_request_user(request) if request else None
        if owner is None:
            raise serializers.ValidationError("Authenticated user required for tags.")
        normalized = [tag.strip().lower() for tag in tags if tag.strip()]
        tag_objs = [
            Tag.objects.get_or_create(owner=owner, name=name)[0] for name in normalized
        ]
        instance.tags.set(tag_objs)

    def _normalize_labels(self, labels: Iterable[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for label in labels or []:
            clean = str(label).strip()
            if not clean:
                continue
            key = clean.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(key)
        return normalized

    def _merge_bucket_tags(self, buckets: Iterable[str], tags: Iterable[str]) -> list[str]:
        bucket_labels = self._normalize_labels(buckets)
        tag_list = self._normalize_labels(tags)
        bucket_set = {label.lower() for label in bucket_labels}
        filtered_tags = [tag for tag in tag_list if tag.lower() not in bucket_set]
        return filtered_tags + bucket_labels


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
    is_global = serializers.BooleanField(read_only=True)
    global_key = serializers.CharField(read_only=True)

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
            "is_global",
            "global_key",
            "is_important",
            "is_done",
            "canvas_json",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "is_global", "global_key"]

    def create(self, validated_data):
        bucket_labels = self._normalize_labels(validated_data.get("bucket_labels", []))
        validated_data["bucket_labels"] = bucket_labels
        tags = validated_data.pop("tags", [])
        merged_tags = self._merge_bucket_tags(bucket_labels, tags)
        instance = super().create(validated_data)
        self._sync_tags(instance, merged_tags)
        return instance

    def update(self, instance, validated_data):
        request = self.context.get("request") if hasattr(self, "context") else None
        is_staff = bool(getattr(getattr(request, "user", None), "is_staff", False))
        if instance.is_global and not is_staff:
            for field in ("title", "category", "references_json", "bucket_labels", "tags"):
                validated_data.pop(field, None)

        tags = validated_data.pop("tags", None)
        bucket_labels_input = validated_data.get("bucket_labels", None)
        if bucket_labels_input is not None:
            bucket_labels = self._normalize_labels(bucket_labels_input)
            validated_data["bucket_labels"] = bucket_labels
        else:
            bucket_labels = list(instance.bucket_labels or [])
        instance = super().update(instance, validated_data)
        if tags is not None or bucket_labels_input is not None:
            existing_tags = [tag.name for tag in instance.tags.all()]
            merged_tags = self._merge_bucket_tags(
                bucket_labels,
                tags if tags is not None else existing_tags,
            )
            self._sync_tags(instance, merged_tags)
        return instance

    def _sync_tags(self, instance: DesignTopic, tags: list[str]) -> None:
        request = self.context.get("request") if hasattr(self, "context") else None
        owner = get_request_user(request) if request else None
        if owner is None:
            raise serializers.ValidationError("Authenticated user required for tags.")
        normalized = [tag.strip().lower() for tag in tags if tag.strip()]
        tag_objs = [
            Tag.objects.get_or_create(owner=owner, name=name)[0] for name in normalized
        ]
        instance.tags.set(tag_objs)

    def _normalize_labels(self, labels: Iterable[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for label in labels or []:
            clean = str(label).strip()
            if not clean:
                continue
            key = clean.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(key)
        return normalized

    def _merge_bucket_tags(self, buckets: Iterable[str], tags: Iterable[str]) -> list[str]:
        bucket_labels = self._normalize_labels(buckets)
        tag_list = self._normalize_labels(tags)
        bucket_set = {label.lower() for label in bucket_labels}
        filtered_tags = [tag for tag in tag_list if tag.lower() not in bucket_set]
        return filtered_tags + bucket_labels


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


class CustomSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomSection
        fields = ["id", "title", "description", "is_global", "global_key", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at", "is_global", "global_key"]

    def update(self, instance, validated_data):
        request = self.context.get("request") if hasattr(self, "context") else None
        is_staff = bool(getattr(getattr(request, "user", None), "is_staff", False))
        if instance.is_global and not is_staff:
            validated_data.pop("title", None)
            validated_data.pop("description", None)
        return super().update(instance, validated_data)


class CustomSubsectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomSubsection
        fields = ["id", "section", "title", "is_global", "global_key", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at", "is_global", "global_key"]

    def validate(self, attrs):
        request = self.context.get("request") if hasattr(self, "context") else None
        owner = get_request_user(request) if request else None
        section = attrs.get("section") or getattr(self.instance, "section", None)
        if owner and section and section.owner_id != owner.id:
            raise serializers.ValidationError("Section does not belong to the current user.")
        return attrs

    def update(self, instance, validated_data):
        request = self.context.get("request") if hasattr(self, "context") else None
        is_staff = bool(getattr(getattr(request, "user", None), "is_staff", False))
        if instance.is_global and not is_staff:
            validated_data.pop("title", None)
            validated_data.pop("section", None)
        return super().update(instance, validated_data)


class CustomQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomQuestion
        fields = [
            "id",
            "section",
            "subsection",
            "title",
            "solution_json",
            "references_json",
            "is_done",
            "is_global",
            "global_key",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "is_global", "global_key"]

    def validate(self, attrs):
        request = self.context.get("request") if hasattr(self, "context") else None
        owner = get_request_user(request) if request else None
        section = attrs.get("section") or getattr(self.instance, "section", None)
        subsection = attrs.get("subsection") or getattr(self.instance, "subsection", None)
        if owner:
            if section and section.owner_id != owner.id:
                raise serializers.ValidationError("Section does not belong to the current user.")
            if subsection and subsection.owner_id != owner.id:
                raise serializers.ValidationError("Subsection does not belong to the current user.")
        if section and subsection and subsection.section_id != section.id:
            raise serializers.ValidationError("Subsection does not belong to the selected section.")
        return attrs

    def update(self, instance, validated_data):
        request = self.context.get("request") if hasattr(self, "context") else None
        is_staff = bool(getattr(getattr(request, "user", None), "is_staff", False))
        if instance.is_global and not is_staff:
            for field in ("title", "section", "subsection"):
                validated_data.pop(field, None)
        return super().update(instance, validated_data)


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
