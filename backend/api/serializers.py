from __future__ import annotations

from typing import Iterable

from rest_framework import serializers

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
        normalized = [tag.strip() for tag in tags if tag.strip()]
        tag_objs = [Tag.objects.get_or_create(name=name)[0] for name in normalized]
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
        normalized = [tag.strip() for tag in tags if tag.strip()]
        tag_objs = [Tag.objects.get_or_create(name=name)[0] for name in normalized]
        instance.tags.set(tag_objs)


class StudySessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudySession
        fields = ["id", "date", "duration_minutes", "focus_area", "notes", "created_at"]
        read_only_fields = ["id", "created_at"]


class ReviewItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewItem
        fields = ["id", "item_type", "ref_id", "next_review_at", "interval_days"]


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
