from __future__ import annotations

from typing import Iterable

from django.contrib.auth import get_user_model
from django.utils.text import slugify

from .models import CustomQuestion, CustomSection, CustomSubsection


def _truncate_key(value: str, length: int = 200) -> str:
    return value[:length]


def derive_section_key(title: str) -> str:
    return _truncate_key(slugify(title) or "custom-section")


def derive_subsection_key(section_key: str, title: str) -> str:
    base = f"{section_key}:{slugify(title)}"
    return _truncate_key(base)


def derive_question_key(subsection_key: str, title: str) -> str:
    base = f"{subsection_key}:{slugify(title)}"
    return _truncate_key(base)


def _sync_section(
    user,
    section_key: str,
    title: str,
    description: str,
) -> CustomSection:
    section, created = CustomSection.objects.get_or_create(
        owner=user,
        global_key=section_key,
        defaults={
            "title": title,
            "description": description,
            "is_global": True,
        },
    )
    if not created:
        updates = {}
        if section.title != title:
            updates["title"] = title
        if section.description != description:
            updates["description"] = description
        if not section.is_global:
            updates["is_global"] = True
        if updates:
            CustomSection.objects.filter(id=section.id).update(**updates)
            section.refresh_from_db()
    return section


def _sync_subsection(
    user,
    section: CustomSection,
    subsection_key: str,
    title: str,
) -> CustomSubsection:
    subsection, created = CustomSubsection.objects.get_or_create(
        owner=user,
        global_key=subsection_key,
        defaults={
            "section": section,
            "title": title,
            "is_global": True,
        },
    )
    if not created:
        updates = {}
        if subsection.title != title:
            updates["title"] = title
        if subsection.section_id != section.id:
            updates["section"] = section
        if not subsection.is_global:
            updates["is_global"] = True
        if updates:
            CustomSubsection.objects.filter(id=subsection.id).update(**updates)
            subsection.refresh_from_db()
    return subsection


def _sync_question(
    user,
    section: CustomSection,
    subsection: CustomSubsection,
    question_key: str,
    title: str,
    references: list | None = None,
) -> CustomQuestion:
    question, created = CustomQuestion.objects.get_or_create(
        owner=user,
        global_key=question_key,
        defaults={
            "section": section,
            "subsection": subsection,
            "title": title,
            "references_json": references or [],
            "is_global": True,
        },
    )
    if not created:
        updates = {}
        if question.title != title:
            updates["title"] = title
        if question.section_id != section.id:
            updates["section"] = section
        if question.subsection_id != subsection.id:
            updates["subsection"] = subsection
        if references is not None and question.references_json != references:
            updates["references_json"] = references
        if not question.is_global:
            updates["is_global"] = True
        if updates:
            CustomQuestion.objects.filter(id=question.id).update(**updates)
            question.refresh_from_db()
    return question


def create_global_sections_for_all_users(payload: dict) -> tuple[int, int]:
    title = payload.get("title") or "Custom Section"
    description = payload.get("description") or ""
    section_key = payload.get("global_key") or derive_section_key(title)
    subsections = payload.get("subsections") or []

    User = get_user_model()
    created = 0
    updated = 0

    for user in User.objects.all():
        section = _sync_section(user, section_key, title, description)
        if section.created_at == section.updated_at:
            created += 1
        else:
            updated += 1

        for subsection_payload in subsections:
            if not isinstance(subsection_payload, dict):
                continue
            subsection_title = subsection_payload.get("title")
            if not subsection_title:
                continue
            subsection_key = subsection_payload.get("global_key") or derive_subsection_key(
                section_key, subsection_title
            )
            subsection = _sync_subsection(user, section, subsection_key, subsection_title)
            if subsection.created_at == subsection.updated_at:
                created += 1
            else:
                updated += 1

            questions = subsection_payload.get("questions") or []
            for question_payload in questions:
                if not isinstance(question_payload, dict):
                    continue
                question_title = question_payload.get("title")
                if not question_title:
                    continue
                question_key = question_payload.get("global_key") or derive_question_key(
                    subsection_key, question_title
                )
                references = question_payload.get("references", []) or []
                question = _sync_question(
                    user,
                    section,
                    subsection,
                    question_key,
                    question_title,
                    references,
                )
                if question.created_at == question.updated_at:
                    created += 1
                else:
                    updated += 1

    return created, updated


def ensure_global_custom_for_user(user) -> int:
    templates = (
        CustomSection.objects.filter(is_global=True, global_key__isnull=False)
        .order_by("global_key", "id")
    )
    seen: set[str] = set()
    created = 0
    for template in templates:
        if not template.global_key or template.global_key in seen:
            continue
        seen.add(template.global_key)
        section = CustomSection.objects.filter(owner=user, global_key=template.global_key).first()
        if section is None:
            section = CustomSection.objects.create(
                owner=user,
                title=template.title,
                description=template.description,
                is_global=True,
                global_key=template.global_key,
            )
            created += 1

        template_subsections = CustomSubsection.objects.filter(
            section=template, is_global=True, global_key__isnull=False
        ).order_by("id")
        for sub in template_subsections:
            subsection = CustomSubsection.objects.filter(owner=user, global_key=sub.global_key).first()
            if subsection is None:
                subsection = CustomSubsection.objects.create(
                    owner=user,
                    section=section,
                    title=sub.title,
                    is_global=True,
                    global_key=sub.global_key,
                )
                created += 1

            template_questions = CustomQuestion.objects.filter(
                section=template,
                subsection=sub,
                is_global=True,
                global_key__isnull=False,
            ).order_by("id")
            for question in template_questions:
                if CustomQuestion.objects.filter(owner=user, global_key=question.global_key).exists():
                    continue
                CustomQuestion.objects.create(
                    owner=user,
                    section=section,
                    subsection=subsection,
                    title=question.title,
                    references_json=question.references_json,
                    is_global=True,
                    global_key=question.global_key,
                )
                created += 1

    return created
