from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0008_dsa_problem_global_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="designtopic",
            name="is_global",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="designtopic",
            name="global_key",
            field=models.CharField(blank=True, db_index=True, max_length=200, null=True),
        ),
    ]
