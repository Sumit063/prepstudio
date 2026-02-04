from __future__ import annotations

from typing import Iterable

from django.contrib.auth import get_user_model
from django.utils.text import slugify

from .models import DesignTopic, Tag

GLOBAL_FIELDS = (
    "title",
    "category",
    "references_json",
    "bucket_labels",
)


def derive_global_key(title: str) -> str:
    return slugify(title)[:200] or "global-topic"


def normalize_tag_names(tags: Iterable[str]) -> list[str]:
    return [tag.strip().lower() for tag in tags if tag and tag.strip()]


def normalize_bucket_labels(labels: Iterable[str]) -> list[str]:
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


def merge_bucket_tags(bucket_labels: Iterable[str], tag_names: Iterable[str]) -> list[str]:
    buckets = normalize_bucket_labels(bucket_labels)
    tags = normalize_tag_names(tag_names)
    bucket_set = {bucket.lower() for bucket in buckets}
    filtered_tags = [tag for tag in tags if tag.lower() not in bucket_set]
    return filtered_tags + buckets


def sync_tags_for_topic(topic: DesignTopic, tag_names: Iterable[str]) -> None:
    owner = topic.owner
    normalized = normalize_tag_names(tag_names)
    tag_objs = [Tag.objects.get_or_create(owner=owner, name=name)[0] for name in normalized]
    topic.tags.set(tag_objs)


def create_global_topics_for_all_users(
    base_data: dict,
    tag_names: Iterable[str],
    global_key: str,
) -> list[DesignTopic]:
    User = get_user_model()
    created: list[DesignTopic] = []
    base_data = {**base_data}
    base_data["bucket_labels"] = normalize_bucket_labels(base_data.get("bucket_labels", []))
    merged_tags = merge_bucket_tags(base_data["bucket_labels"], tag_names)
    for user in User.objects.all():
        topic = DesignTopic.objects.create(
            owner=user,
            is_global=True,
            global_key=global_key,
            **base_data,
        )
        sync_tags_for_topic(topic, merged_tags)
        created.append(topic)
    return created


def update_global_topics(
    global_key: str,
    base_updates: dict,
    tag_names: Iterable[str] | None = None,
) -> None:
    bucket_labels = None
    if base_updates:
        base_updates = {**base_updates}
        if "bucket_labels" in base_updates:
            bucket_labels = normalize_bucket_labels(base_updates.get("bucket_labels", []))
            base_updates["bucket_labels"] = bucket_labels
        DesignTopic.objects.filter(is_global=True, global_key=global_key).update(**base_updates)
    if tag_names is not None or bucket_labels is not None:
        for topic in DesignTopic.objects.filter(is_global=True, global_key=global_key):
            merged_tags = merge_bucket_tags(
                bucket_labels if bucket_labels is not None else topic.bucket_labels,
                tag_names if tag_names is not None else [tag.name for tag in topic.tags.all()],
            )
            sync_tags_for_topic(topic, merged_tags)


def ensure_global_topics_for_user(user) -> int:
    templates = (
        DesignTopic.objects.filter(is_global=True, global_key__isnull=False)
        .order_by("global_key", "id")
        .prefetch_related("tags")
    )
    seen: set[str] = set()
    created = 0
    for template in templates:
        if template.global_key in seen:
            continue
        seen.add(template.global_key)
        if DesignTopic.objects.filter(owner=user, global_key=template.global_key).exists():
            continue
        base_data = {field: getattr(template, field) for field in GLOBAL_FIELDS}
        base_data["bucket_labels"] = normalize_bucket_labels(base_data.get("bucket_labels", []))
        topic = DesignTopic.objects.create(
            owner=user,
            is_global=True,
            global_key=template.global_key,
            **base_data,
        )
        merged_tags = merge_bucket_tags(
            base_data["bucket_labels"],
            [tag.name for tag in template.tags.all()],
        )
        sync_tags_for_topic(topic, merged_tags)
        created += 1
    return created
