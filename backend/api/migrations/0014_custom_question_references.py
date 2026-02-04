from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0013_custom_section_globals"),
    ]

    operations = [
        migrations.AddField(
            model_name="customquestion",
            name="references_json",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
