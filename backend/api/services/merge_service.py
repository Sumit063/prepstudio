from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from rest_framework.exceptions import PermissionDenied

from api.models import DesignTopic, DSAProblem
from api.repositories.buddy_repository import list_accepted_buddies


@dataclass
class SharedContentEntry:
    id: str
    type: str
    content: Any
    language: str | None
    created_at: str
    owner: dict


def _serialize_owner(user) -> dict:
    name = f"{user.first_name} {user.last_name}".strip() or user.username
    return {
        "id": user.id,
        "name": name,
        "username": user.username,
        "avatarUrl": "",
    }


def _normalize_language(value: str | None) -> str | None:
    if not value:
        return None
    lower = value.lower()
    if lower in {"python", "py"}:
        return "python"
    if lower == "java":
        return "java"
    if lower in {"cpp", "c++"}:
        return "cpp"
    return None


def _parse_snippet_payload(raw: str | None) -> list[dict]:
    if not raw:
        return []
    try:
        parsed = __import__("json").loads(raw)
    except Exception:
        return []
    if isinstance(parsed, list):
        candidates = parsed
    elif isinstance(parsed, dict):
        candidates = parsed.get("snippets") or parsed.get("codeSnippets") or parsed.get("blocks") or []
    else:
        return []
    snippets = []
    for index, item in enumerate(candidates):
        if not isinstance(item, dict):
            continue
        language = _normalize_language(item.get("language"))
        if not language:
            continue
        snippets.append(
            {
                "id": item.get("id") or f"snippet-{index}",
                "title": item.get("title") or "",
                "language": language,
                "code": item.get("code") or "",
            }
        )
    return snippets


def _build_problem_entries(problem: DSAProblem) -> list[SharedContentEntry]:
    owner = _serialize_owner(problem.owner)
    entries: list[SharedContentEntry] = []
    updated = problem.updated_at.isoformat()

    if problem.workspace_notes:
        entries.append(
            SharedContentEntry(
                id=f"workspace-{problem.owner_id}-{problem.id}",
                type="workspace_note",
                content=problem.workspace_notes,
                language=None,
                created_at=updated,
                owner=owner,
            )
        )

    snippets = _parse_snippet_payload(problem.solution_notes)
    if snippets:
        for snippet in snippets:
            entries.append(
                SharedContentEntry(
                    id=f"snippet-{problem.owner_id}-{problem.id}-{snippet['id']}",
                    type="code_snippet",
                    content={"title": snippet.get("title", ""), "code": snippet.get("code", "")},
                    language=snippet.get("language"),
                    created_at=updated,
                    owner=owner,
                )
            )
    elif problem.solution_notes:
        entries.append(
            SharedContentEntry(
                id=f"solution-{problem.owner_id}-{problem.id}",
                type="solution_note",
                content=problem.solution_notes,
                language=None,
                created_at=updated,
                owner=owner,
            )
        )

    if isinstance(problem.approaches_json, list):
        for index, approach in enumerate(problem.approaches_json):
            if not isinstance(approach, dict):
                continue
            title = approach.get("title") or f"Approach {index + 1}"
            notes = approach.get("notes") or ""
            if not (title or notes):
                continue
            entries.append(
                SharedContentEntry(
                    id=f"approach-{problem.owner_id}-{problem.id}-{index}",
                    type="approach",
                    content={"title": title, "notes": notes},
                    language=None,
                    created_at=updated,
                    owner=owner,
                )
            )

    return entries


def _build_topic_entries(topic: DesignTopic) -> list[SharedContentEntry]:
    owner = _serialize_owner(topic.owner)
    entries: list[SharedContentEntry] = []
    updated = topic.updated_at.isoformat()

    if topic.notes_markdown:
        entries.append(
            SharedContentEntry(
                id=f"notes-{topic.owner_id}-{topic.id}",
                type="notes",
                content=topic.notes_markdown,
                language=None,
                created_at=updated,
                owner=owner,
            )
        )

    if topic.tradeoffs:
        entries.append(
            SharedContentEntry(
                id=f"tradeoffs-{topic.owner_id}-{topic.id}",
                type="tradeoffs",
                content=topic.tradeoffs,
                language=None,
                created_at=updated,
                owner=owner,
            )
        )

    if topic.references_json:
        entries.append(
            SharedContentEntry(
                id=f"references-{topic.owner_id}-{topic.id}",
                type="references",
                content=topic.references_json,
                language=None,
                created_at=updated,
                owner=owner,
            )
        )

    if topic.canvas_json:
        entries.append(
            SharedContentEntry(
                id=f"canvas-{topic.owner_id}-{topic.id}",
                type="canvas",
                content=topic.canvas_json,
                language=None,
                created_at=updated,
                owner=owner,
            )
        )

    return entries


def get_merged_user_ids(user) -> list[int]:
    buddies = list_accepted_buddies(user)
    return [user.id] + [buddy.id for buddy in buddies]


def get_merged_dsa_list(user) -> list[DSAProblem]:
    user_ids = get_merged_user_ids(user)
    problems = (
        DSAProblem.objects.filter(owner_id__in=user_ids)
        .select_related("owner")
        .prefetch_related("tags")
        .order_by("-updated_at")
    )
    grouped: dict[str, list[DSAProblem]] = {}
    for problem in problems:
        key = f"global:{problem.global_key}" if problem.global_key else f"id:{problem.id}"
        grouped.setdefault(key, []).append(problem)

    merged: list[DSAProblem] = []
    for group in grouped.values():
        primary = next((item for item in group if item.owner_id == user.id), group[0])
        merged.append(primary)
    return merged


def get_merged_design_list(user) -> list[DesignTopic]:
    user_ids = get_merged_user_ids(user)
    topics = (
        DesignTopic.objects.filter(owner_id__in=user_ids)
        .select_related("owner")
        .prefetch_related("tags")
        .order_by("-updated_at")
    )
    grouped: dict[str, list[DesignTopic]] = {}
    for topic in topics:
        key = f"global:{topic.global_key}" if topic.global_key else f"id:{topic.id}"
        grouped.setdefault(key, []).append(topic)

    merged: list[DesignTopic] = []
    for group in grouped.values():
        primary = next((item for item in group if item.owner_id == user.id), group[0])
        merged.append(primary)
    return merged


def get_merged_problem_detail(user, problem_id: int) -> tuple[DSAProblem, list[SharedContentEntry]]:
    user_ids = get_merged_user_ids(user)
    problem = (
        DSAProblem.objects.select_related("owner")
        .prefetch_related("tags")
        .filter(id=problem_id, owner_id__in=user_ids)
        .first()
    )
    if not problem:
        raise PermissionDenied("Problem not accessible.")

    if problem.global_key:
        related = (
            DSAProblem.objects.select_related("owner")
            .filter(owner_id__in=user_ids, global_key=problem.global_key)
            .order_by("-updated_at")
        )
    else:
        related = [problem]

    entries: list[SharedContentEntry] = []
    for item in related:
        entries.extend(_build_problem_entries(item))

    entries.sort(key=lambda entry: entry.created_at, reverse=True)
    return problem, entries


def get_merged_topic_detail(user, topic_id: int) -> tuple[DesignTopic, list[SharedContentEntry]]:
    user_ids = get_merged_user_ids(user)
    topic = (
        DesignTopic.objects.select_related("owner")
        .prefetch_related("tags")
        .filter(id=topic_id, owner_id__in=user_ids)
        .first()
    )
    if not topic:
        raise PermissionDenied("Topic not accessible.")

    if topic.global_key:
        related = (
            DesignTopic.objects.select_related("owner")
            .filter(owner_id__in=user_ids, global_key=topic.global_key)
            .order_by("-updated_at")
        )
    else:
        related = [topic]

    entries: list[SharedContentEntry] = []
    for item in related:
        entries.extend(_build_topic_entries(item))

    entries.sort(key=lambda entry: entry.created_at, reverse=True)
    return topic, entries
