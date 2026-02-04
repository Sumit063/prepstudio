from __future__ import annotations

import json
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from api.global_custom import create_global_sections_for_all_users
from api.models import CustomQuestion, CustomSection, CustomSubsection


class Command(BaseCommand):
    help = "Seed global Custom Sections catalog from a local JSON file"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default=str(Path("data") / "custom_sections_catalog.json"),
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
            CustomQuestion.objects.filter(is_global=True).delete()
            CustomSubsection.objects.filter(is_global=True).delete()
            CustomSection.objects.filter(is_global=True).delete()

        with file_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)

        if not isinstance(payload, list):
            raise CommandError("Catalog JSON must be a list of section objects.")

        created = 0
        updated = 0
        for item in payload:
            if not isinstance(item, dict):
                continue
            if not item.get("title"):
                continue
            created_delta, updated_delta = create_global_sections_for_all_users(item)
            created += created_delta
            updated += updated_delta

        self.stdout.write(
            self.style.SUCCESS(
                f"Custom sections catalog synced. Created: {created}, updated: {updated}."
            )
        )
