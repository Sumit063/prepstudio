from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0012_custom_question_done"),
    ]

    operations = [
        migrations.AddField(
            model_name="customsection",
            name="global_key",
            field=models.CharField(blank=True, db_index=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name="customsection",
            name="is_global",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="customsubsection",
            name="global_key",
            field=models.CharField(blank=True, db_index=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name="customsubsection",
            name="is_global",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="customquestion",
            name="global_key",
            field=models.CharField(blank=True, db_index=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name="customquestion",
            name="is_global",
            field=models.BooleanField(default=False),
        ),
    ]
