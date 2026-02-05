from __future__ import annotations

import os
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.global_custom import ensure_global_custom_for_user
from api.global_design import ensure_global_topics_for_user
from api.global_dsa import ensure_global_problems_for_user
from api.models import (
        DesignTopic,
        DSAAttempt,
        DSAProblem,
    ReviewItem,
    StudySession,
    Tag,
)


class Command(BaseCommand):
    help = "Seed PrepStudio with sample data"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing data first")

    def handle(self, *args, **options):
        User = get_user_model()
        demo_username = os.getenv("DEMO_USERNAME", "demo")
        demo_email = os.getenv("DEMO_EMAIL", "demo@prepstudio.local")
        demo_password = os.getenv("DEMO_PASSWORD", "demo-password")

        demo_user, created = User.objects.get_or_create(
            username=demo_username, defaults={"email": demo_email}
        )
        if created:
            demo_user.set_password(demo_password)
            demo_user.save()
        if not demo_user.is_active:
            demo_user.is_active = True
            demo_user.save(update_fields=["is_active"])

        if options.get("reset"):
            self.stdout.write("Clearing existing demo data...")
            DSAAttempt.objects.filter(owner=demo_user).delete()
            DSAProblem.objects.filter(owner=demo_user, is_global=False).delete()
            DesignTopic.objects.filter(owner=demo_user, is_global=False).delete()
            StudySession.objects.filter(owner=demo_user).delete()
            ReviewItem.objects.filter(owner=demo_user).delete()

        tags = [
            "arrays",
            "hashmap",
            "two-pointers",
            "graphs",
            "dfs",
            "bfs",
            "binary-search",
            "dp",
            "cache",
            "queue",
            "scaling",
            "consistency",
            "system-design",
        ]
        tag_objs = {
            name: Tag.objects.get_or_create(owner=demo_user, name=name)[0] for name in tags
        }

        problems_data = [
            {
                "title": "Two Sum",
                "platform": DSAProblem.Platform.LEETCODE,
                "link": "https://leetcode.com/problems/two-sum",
                "difficulty": 2,
                "tags": ["arrays", "hashmap"],
                "statement": "Find indices of two numbers that add to target.",
                "solution_notes": "Hashmap for O(n) lookup.",
                "workspace_notes": "Remember to handle duplicates.",
                "approaches_json": [{"title": "Hashmap", "notes": "One-pass map for O(n)."}],
                "bucket_labels": ["core"],
                "is_important": True,
                "is_done": True,
            },
            {
                "title": "Trapping Rain Water",
                "platform": DSAProblem.Platform.LEETCODE,
                "link": "https://leetcode.com/problems/trapping-rain-water",
                "difficulty": 3,
                "tags": ["two-pointers"],
                "statement": "Compute trapped rain water between bars.",
                "solution_notes": "Two pointers tracking max left/right.",
            },
            {
                "title": "Median of Two Sorted Arrays",
                "platform": DSAProblem.Platform.LEETCODE,
                "link": "https://leetcode.com/problems/median-of-two-sorted-arrays",
                "difficulty": 5,
                "tags": ["binary-search"],
                "statement": "Find median of two sorted arrays in log time.",
                "solution_notes": "Partition arrays to balance halves.",
            },
            {
                "title": "LRU Cache",
                "platform": DSAProblem.Platform.CUSTOM,
                "link": "",
                "difficulty": 4,
                "tags": ["hashmap", "cache"],
                "statement": "Implement LRU cache with O(1) ops.",
                "solution_notes": "DLL + hashmap.",
            },
            {
                "title": "Detect Cycle in Directed Graph",
                "platform": DSAProblem.Platform.GFG,
                "link": "https://practice.geeksforgeeks.org",
                "difficulty": 4,
                "tags": ["graphs", "dfs"],
                "statement": "Detect cycle using DFS recursion stack.",
                "solution_notes": "Track visiting states.",
            },
            {
                "title": "Binary Tree Level Order Traversal",
                "platform": DSAProblem.Platform.LEETCODE,
                "link": "https://leetcode.com/problems/binary-tree-level-order-traversal",
                "difficulty": 2,
                "tags": ["bfs", "queue"],
                "statement": "Return level order traversal of a tree.",
                "solution_notes": "Queue based BFS.",
            },
            {
                "title": "Longest Increasing Subsequence",
                "platform": DSAProblem.Platform.LEETCODE,
                "link": "https://leetcode.com/problems/longest-increasing-subsequence",
                "difficulty": 4,
                "tags": ["dp", "binary-search"],
                "statement": "Find LIS length.",
                "solution_notes": "Patience sorting.",
            },
            {
                "title": "Rotate Matrix",
                "platform": DSAProblem.Platform.GFG,
                "link": "https://practice.geeksforgeeks.org",
                "difficulty": 3,
                "tags": ["arrays"],
                "statement": "Rotate N x N matrix in-place.",
                "solution_notes": "Transpose + reverse rows.",
            },
            {
                "title": "Merge Intervals",
                "platform": DSAProblem.Platform.LEETCODE,
                "link": "https://leetcode.com/problems/merge-intervals",
                "difficulty": 3,
                "tags": ["arrays"],
                "statement": "Merge overlapping intervals.",
                "solution_notes": "Sort by start, merge greedily.",
            },
            {
                "title": "Word Ladder",
                "platform": DSAProblem.Platform.LEETCODE,
                "link": "https://leetcode.com/problems/word-ladder",
                "difficulty": 4,
                "tags": ["bfs", "graphs"],
                "statement": "Shortest transformation sequence.",
                "solution_notes": "Bidirectional BFS.",
            },
        ]

        problems = []
        for problem_data in problems_data:
            tags_for_problem = problem_data.pop("tags")
            problem = (
                DSAProblem.objects.filter(owner=demo_user, link=problem_data.get("link", "")).first()
                or DSAProblem.objects.filter(owner=demo_user, title=problem_data["title"]).first()
            )
            created_problem = False
            if problem is None:
                problem = DSAProblem.objects.create(owner=demo_user, **problem_data)
                created_problem = True
            if not created_problem:
                for key, value in problem_data.items():
                    if problem.is_global and key in {"title", "platform", "link", "difficulty", "bucket_labels"}:
                        continue
                    setattr(problem, key, value)
                problem.save(update_fields=list(problem_data.keys()))
            problem.tags.set([tag_objs[tag] for tag in tags_for_problem])
            problem.workspace_notes = problem_data.get("workspace_notes", problem.workspace_notes)
            problem.approaches_json = problem_data.get("approaches_json", problem.approaches_json)
            problem.bucket_labels = problem_data.get("bucket_labels", problem.bucket_labels)
            problem.is_important = problem_data.get("is_important", problem.is_important)
            problem.is_done = problem_data.get("is_done", problem.is_done)
            problem.save()
            problems.append(problem)

        now = timezone.now()
        for index, problem in enumerate(problems[:8]):
            DSAAttempt.objects.create(
                owner=demo_user,
                problem=problem,
                status=DSAAttempt.Status.SOLVED if index % 3 == 0 else DSAAttempt.Status.PARTIAL,
                time_taken_minutes=20 + index * 5,
                mistakes="Edge cases and time constraints" if index % 2 else "",
                notes="Review solution patterns",
                created_at=now - timedelta(days=index + 1),
            )

        topics_data = [
            {
                "title": "Realtime analytics pipeline",
                "category": DesignTopic.Category.HLD,
                "tags": ["system-design", "scaling"],
                "notes_markdown": "Kafka + Flink pipeline with tiered storage.",
                "tradeoffs": "Latency vs. cost.",
                "references_json": ["https://kafka.apache.org/"],
                "bucket_labels": ["streams"],
                "is_important": True,
                "is_done": False,
                "canvas_json": {},
            },
            {
                "title": "Rate limiter",
                "category": DesignTopic.Category.LLD,
                "tags": ["cache"],
                "notes_markdown": "Token bucket with Redis Lua scripts.",
                "tradeoffs": "Memory vs. precision.",
                "references_json": ["https://redis.io/"],
            },
            {
                "title": "Caching hierarchy",
                "category": DesignTopic.Category.CACHE,
                "tags": ["cache"],
                "notes_markdown": "Client + edge caching strategy.",
                "tradeoffs": "Freshness vs. latency.",
                "references_json": [],
            },
            {
                "title": "Multi-tenant schema strategy",
                "category": DesignTopic.Category.DB,
                "tags": ["scaling"],
                "notes_markdown": "Shared vs isolated schemas.",
                "tradeoffs": "Operational complexity.",
                "references_json": [],
            },
            {
                "title": "Queue-based fanout",
                "category": DesignTopic.Category.QUEUE,
                "tags": ["queue"],
                "notes_markdown": "SNS to SQS fanout pattern.",
                "tradeoffs": "Delivery guarantees.",
                "references_json": [],
            },
            {
                "title": "Consistency models",
                "category": DesignTopic.Category.CONSISTENCY,
                "tags": ["consistency"],
                "notes_markdown": "Quorum reads/writes with read repair.",
                "tradeoffs": "Latency vs. availability.",
                "references_json": [],
            },
            {
                "title": "Service sharding",
                "category": DesignTopic.Category.SCALING,
                "tags": ["scaling"],
                "notes_markdown": "Shard by tenant with rebalancing.",
                "tradeoffs": "Cross-shard queries.",
                "references_json": [],
            },
            {
                "title": "CDC ingestion",
                "category": DesignTopic.Category.HLD,
                "tags": ["system-design"],
                "notes_markdown": "Debezium + Kafka Connect.",
                "tradeoffs": "Operational overhead.",
                "references_json": [],
            },
        ]

        for topic_data in topics_data:
            tags_for_topic = topic_data.pop("tags")
            topic = (
                DesignTopic.objects.filter(owner=demo_user, title=topic_data["title"]).first()
            )
            created_topic = False
            if topic is None:
                topic = DesignTopic.objects.create(owner=demo_user, **topic_data)
                created_topic = True
            if not created_topic:
                for key, value in topic_data.items():
                    if topic.is_global and key in {"title", "category", "references_json", "bucket_labels"}:
                        continue
                    setattr(topic, key, value)
                topic.save(update_fields=list(topic_data.keys()))
            topic.tags.set([tag_objs[tag] for tag in tags_for_topic if tag in tag_objs])
            topic.bucket_labels = topic_data.get("bucket_labels", topic.bucket_labels)
            topic.is_important = topic_data.get("is_important", topic.is_important)
            topic.is_done = topic_data.get("is_done", topic.is_done)
            topic.canvas_json = topic_data.get("canvas_json", topic.canvas_json)
            topic.save()

        sessions_data = [
            {
                "date": date.today() - timedelta(days=1),
                "duration_minutes": 90,
                "focus_area": StudySession.FocusArea.MIXED,
                "notes": "DSA warm-up + design notes cleanup.",
            },
            {
                "date": date.today() - timedelta(days=3),
                "duration_minutes": 75,
                "focus_area": StudySession.FocusArea.DSA,
                "notes": "Binary search patterns review.",
            },
            {
                "date": date.today() - timedelta(days=5),
                "duration_minutes": 60,
                "focus_area": StudySession.FocusArea.DESIGN,
                "notes": "Caching strategies.",
            },
        ]

        for session_data in sessions_data:
            StudySession.objects.get_or_create(
                owner=demo_user, date=session_data["date"], defaults=session_data
            )

        review_items = []
        for problem in problems[:3]:
            review_items.append(
                ReviewItem.objects.get_or_create(
                    owner=demo_user,
                    item_type=ReviewItem.ItemType.DSA_PROBLEM,
                    ref_id=problem.id,
                    defaults={"next_review_at": now + timedelta(days=1), "interval_days": 2},
                )[0]
            )
        for topic in DesignTopic.objects.filter(owner=demo_user)[:2]:
            review_items.append(
                ReviewItem.objects.get_or_create(
                    owner=demo_user,
                    item_type=ReviewItem.ItemType.DESIGN_TOPIC,
                    ref_id=topic.id,
                    defaults={"next_review_at": now, "interval_days": 1},
                )[0]
            )

        ensure_global_problems_for_user(demo_user)
        ensure_global_topics_for_user(demo_user)
        ensure_global_custom_for_user(demo_user)
        self.stdout.write(self.style.SUCCESS("Seed data loaded."))
