from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0006_studysession_start_time"),
    ]

    operations = [
        migrations.AddField(
            model_name="reviewitem",
            name="calendar_event_id",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="reviewitem",
            name="calendar_event_link",
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name="reviewitem",
            name="calendar_error",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="reviewitem",
            name="calendar_synced_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
