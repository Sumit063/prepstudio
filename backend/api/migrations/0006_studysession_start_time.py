from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0005_google_calendar_and_session_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="studysession",
            name="start_time",
            field=models.TimeField(blank=True, null=True),
        ),
    ]
