from __future__ import annotations

import json
from pathlib import Path
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from api.global_dsa import (
    create_global_problems_for_all_users,
    derive_global_key,
    update_global_problems,
)
from api.models import DSAProblem


class Command(BaseCommand):
    help = "Seed global DSA catalog from a local JSON file"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default=str(Path("data") / "dsa_catalog.json"),
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
            DSAProblem.objects.filter(is_global=True).delete()

        with file_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)

        if not isinstance(payload, list):
            raise CommandError("Catalog JSON must be a list of question objects.")

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
                "platform": item.get("platform") or DSAProblem.Platform.LEETCODE,
                "link": item.get("link", ""),
                "difficulty": int(item.get("difficulty", 3)),
                "bucket_labels": item.get("bucket_labels", []) or [],
            }
            tags = item.get("tags", []) or []
            global_key = item.get("global_key") or derive_global_key(title, base_data.get("link"))

            if DSAProblem.objects.filter(is_global=True, global_key=global_key).exists():
                update_global_problems(global_key, base_data, tags)
                updated += 1
                continue

            create_global_problems_for_all_users(base_data, tags, global_key)
            created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Global DSA catalog synced. Created: {created}, updated: {updated}."
            )
        )
