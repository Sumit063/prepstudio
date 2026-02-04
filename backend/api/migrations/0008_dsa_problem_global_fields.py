from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0007_reviewitem_calendar_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="dsaproblem",
            name="is_global",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="dsaproblem",
            name="global_key",
            field=models.CharField(blank=True, db_index=True, max_length=200, null=True),
        ),
    ]
