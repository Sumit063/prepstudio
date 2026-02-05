from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from api.global_custom import ensure_global_custom_for_user
from api.global_design import ensure_global_topics_for_user
from api.global_dsa import ensure_global_problems_for_user
from api.models import DesignTopic, DSAAttempt, DSAProblem, ReviewItem, StudySession, Tag


class Command(BaseCommand):
    help = "Seed PrepStudio with global catalogs for the demo user"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing data first")

    def handle(self, *args, **options):
        User = get_user_model()
        demo_username = os.getenv("DEMO_USERNAME", "demo")
        demo_email = os.getenv("DEMO_EMAIL", "demo@prepstudio.local")
        demo_password = os.getenv("DEMO_PASSWORD", "demo-password")

        demo_user, created = User.objects.get_or_create(
            username=demo_username, defaults={"email": demo_email}
        )
        if created:
            demo_user.set_password(demo_password)
            demo_user.save()
        if not demo_user.is_active:
            demo_user.is_active = True
            demo_user.save(update_fields=["is_active"])

        if options.get("reset"):
            self.stdout.write("Clearing existing demo data...")
            DSAAttempt.objects.filter(owner=demo_user).delete()
            DSAProblem.objects.filter(owner=demo_user, is_global=False).delete()
            DesignTopic.objects.filter(owner=demo_user, is_global=False).delete()
            StudySession.objects.filter(owner=demo_user).delete()
            ReviewItem.objects.filter(owner=demo_user).delete()
            Tag.objects.filter(owner=demo_user).delete()

        ensure_global_problems_for_user(demo_user)
        ensure_global_topics_for_user(demo_user)
        ensure_global_custom_for_user(demo_user)

        self.stdout.write(self.style.SUCCESS("Seeded global catalogs for demo user."))
