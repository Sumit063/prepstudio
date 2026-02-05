from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0014_custom_question_references"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="dsaproblem",
            name="workspace_notes",
        ),
        migrations.RemoveField(
            model_name="customquestion",
            name="section",
        ),
    ]
