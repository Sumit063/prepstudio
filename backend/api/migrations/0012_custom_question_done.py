from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0011_custom_sections"),
    ]

    operations = [
        migrations.AddField(
            model_name="customquestion",
            name="is_done",
            field=models.BooleanField(default=False),
        ),
    ]
