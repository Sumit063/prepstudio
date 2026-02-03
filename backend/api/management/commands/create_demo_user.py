import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create or update a demo user for local JWT login."

    def add_arguments(self, parser):
        parser.add_argument("--username", type=str, help="Demo username")
        parser.add_argument("--password", type=str, help="Demo password")
        parser.add_argument("--email", type=str, help="Demo email")

    def handle(self, *args, **options):
        username = options.get("username") or os.getenv("DEMO_USERNAME", "demo")
        password = options.get("password") or os.getenv("DEMO_PASSWORD", "demo-password")
        email = options.get("email") or os.getenv("DEMO_EMAIL", "demo@prepstudio.local")

        User = get_user_model()
        user, created = User.objects.get_or_create(username=username, defaults={"email": email})
        user.email = email
        user.is_active = True
        user.set_password(password)
        user.save(update_fields=["email", "is_active", "password"])

        status = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{status} demo user: {username}"))
