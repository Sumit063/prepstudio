from __future__ import annotations

import json
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from api.global_design import (
    create_global_topics_for_all_users,
    derive_global_key,
    update_global_topics,
)
from api.models import DesignTopic


class Command(BaseCommand):
    help = "Seed global System Design catalog from a local JSON file"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default=str(Path("data") / "design_catalog.json"),
            help="Path to JSON catalog file",
        )
        parser.add_argument("--reset", action="store_true", help="Delete existing global catalog entries")

    def handle(self, *args, **options):
        file_path = Path(options.get("file"))
        if not file_path.exists():
            raise CommandError(f"Catalog file not found: {file_path}")

        User = get_user_model()
        if not User.objects.exists():
            self.stdout.write(self.style.WARNING("No users found. Create a user first."))
            return

        if options.get("reset"):
            DesignTopic.objects.filter(is_global=True).delete()

        with file_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)

        if not isinstance(payload, list):
            raise CommandError("Catalog JSON must be a list of topic objects.")

        created = 0
        updated = 0
        for item in payload:
            if not isinstance(item, dict):
                continue
            title = item.get("title")
            if not title:
                continue
            base_data = {
                "title": title,
                "category": item.get("category") or DesignTopic.Category.HLD,
                "references_json": item.get("references_json", []) or [],
                "bucket_labels": item.get("bucket_labels", []) or [],
            }
            tags = item.get("tags", []) or []
            global_key = item.get("global_key") or derive_global_key(title)

            if DesignTopic.objects.filter(is_global=True, global_key=global_key).exists():
                update_global_topics(global_key, base_data, tags)
                updated += 1
                continue

            create_global_topics_for_all_users(base_data, tags, global_key)
            created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Global Design catalog synced. Created: {created}, updated: {updated}."
            )
        )
