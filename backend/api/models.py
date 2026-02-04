from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Tag(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tags"
    )
    name = models.CharField(max_length=64)

    class Meta:
        unique_together = ("owner", "name")

    def __str__(self) -> str:
        return self.name


class DSAProblem(models.Model):
    class Platform(models.TextChoices):
        LEETCODE = "LEETCODE", "LeetCode"
        GFG = "GFG", "GFG"
        CUSTOM = "CUSTOM", "Custom"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dsa_problems"
    )
    title = models.CharField(max_length=200)
    platform = models.CharField(max_length=20, choices=Platform.choices, default=Platform.LEETCODE)
    link = models.URLField(blank=True)
    difficulty = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    tags = models.ManyToManyField(Tag, related_name="dsa_problems", blank=True)
    statement = models.TextField(blank=True)
    solution_notes = models.TextField(blank=True)
    workspace_notes = models.TextField(blank=True)
    approaches_json = models.JSONField(default=list, blank=True)
    bucket_labels = models.JSONField(default=list, blank=True)
    is_global = models.BooleanField(default=False)
    global_key = models.CharField(max_length=200, blank=True, null=True, db_index=True)
    is_important = models.BooleanField(default=False)
    is_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.title


class DSAAttempt(models.Model):
    class Status(models.TextChoices):
        UNSOLVED = "UNSOLVED", "Unsolved"
        PARTIAL = "PARTIAL", "Partial"
        SOLVED = "SOLVED", "Solved"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="dsa_attempts"
    )
    problem = models.ForeignKey(DSAProblem, related_name="attempts", on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNSOLVED)
    time_taken_minutes = models.PositiveIntegerField(default=0)
    mistakes = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.problem.title} ({self.status})"


class DesignTopic(models.Model):
    class Category(models.TextChoices):
        HLD = "HLD", "HLD"
        LLD = "LLD", "LLD"
        DB = "DB", "DB"
        CACHE = "CACHE", "Cache"
        QUEUE = "QUEUE", "Queue"
        SCALING = "SCALING", "Scaling"
        CONSISTENCY = "CONSISTENCY", "Consistency"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="design_topics"
    )
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.HLD)
    tags = models.ManyToManyField(Tag, related_name="design_topics", blank=True)
    notes_markdown = models.TextField(blank=True)
    tradeoffs = models.TextField(blank=True)
    references_json = models.JSONField(default=list, blank=True)
    bucket_labels = models.JSONField(default=list, blank=True)
    is_global = models.BooleanField(default=False)
    global_key = models.CharField(max_length=200, blank=True, null=True, db_index=True)
    is_important = models.BooleanField(default=False)
    is_done = models.BooleanField(default=False)
    canvas_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.title


class StudySession(models.Model):
    class FocusArea(models.TextChoices):
        DSA = "DSA", "DSA"
        DESIGN = "DESIGN", "Design"
        MIXED = "MIXED", "Mixed"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="study_sessions"
    )
    date = models.DateField()
    start_time = models.TimeField(blank=True, null=True)
    duration_minutes = models.PositiveIntegerField()
    focus_area = models.CharField(max_length=20, choices=FocusArea.choices, default=FocusArea.MIXED)
    notes = models.TextField(blank=True)
    calendar_event_id = models.CharField(max_length=255, blank=True)
    calendar_event_link = models.URLField(blank=True)
    calendar_error = models.TextField(blank=True)
    calendar_synced_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.date} ({self.focus_area})"


class ReviewItem(models.Model):
    class ItemType(models.TextChoices):
        DSA_PROBLEM = "DSA_PROBLEM", "DSA Problem"
        DESIGN_TOPIC = "DESIGN_TOPIC", "Design Topic"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="review_items"
    )
    item_type = models.CharField(max_length=20, choices=ItemType.choices)
    ref_id = models.PositiveIntegerField()
    next_review_at = models.DateTimeField()
    interval_days = models.PositiveIntegerField(default=1)
    calendar_event_id = models.CharField(max_length=255, blank=True)
    calendar_event_link = models.URLField(blank=True)
    calendar_error = models.TextField(blank=True)
    calendar_synced_at = models.DateTimeField(blank=True, null=True)

    def __str__(self) -> str:
        return f"{self.item_type} #{self.ref_id}"


class AuditEvent(models.Model):
    class Source(models.TextChoices):
        WEB = "WEB", "Web"
        MCP = "MCP", "MCP"

    class Status(models.TextChoices):
        SUCCESS = "SUCCESS", "Success"
        FAIL = "FAIL", "Fail"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="audit_events"
    )
    source = models.CharField(max_length=10, choices=Source.choices)
    tool_name = models.CharField(max_length=120)
    input_summary = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices)
    error_message = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.source} {self.tool_name} ({self.status})"


class GoogleCalendarAccount(models.Model):
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="google_calendar"
    )
    email = models.EmailField(blank=True)
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField()
    token_expiry = models.DateTimeField(blank=True, null=True)
    scope = models.TextField(blank=True)
    calendar_id = models.CharField(max_length=128, default="primary")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.owner} Google Calendar"


class BuddyRelationship(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        BLOCKED = "BLOCKED", "Blocked"

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="buddy_requests_sent"
    )
    addressee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="buddy_requests_received"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("requester", "addressee")

    def __str__(self) -> str:
        return f"{self.requester} -> {self.addressee} ({self.status})"
