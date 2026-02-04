from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_persist_user_content"),
    ]

    operations = [
        migrations.AddField(
            model_name="studysession",
            name="calendar_event_id",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="studysession",
            name="calendar_event_link",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="studysession",
            name="calendar_error",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="studysession",
            name="calendar_synced_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="GoogleCalendarAccount",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("access_token", models.TextField(blank=True)),
                ("refresh_token", models.TextField()),
                ("token_expiry", models.DateTimeField(blank=True, null=True)),
                ("scope", models.TextField(blank=True)),
                ("calendar_id", models.CharField(default="primary", max_length=128)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "owner",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="google_calendar",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
    ]
