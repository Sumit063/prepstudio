from __future__ import annotations

from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

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
        if options.get("reset"):
            self.stdout.write("Clearing existing data...")
            DSAAttempt.objects.all().delete()
            DSAProblem.objects.all().delete()
            DesignTopic.objects.all().delete()
            StudySession.objects.all().delete()
            ReviewItem.objects.all().delete()
            Tag.objects.all().delete()

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
        tag_objs = {name: Tag.objects.get_or_create(name=name)[0] for name in tags}

        problems_data = [
            {
                "title": "Two Sum",
                "platform": DSAProblem.Platform.LEETCODE,
                "link": "https://leetcode.com/problems/two-sum",
                "difficulty": 2,
                "tags": ["arrays", "hashmap"],
                "statement": "Find indices of two numbers that add to target.",
                "solution_notes": "Hashmap for O(n) lookup.",
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
            problem, _ = DSAProblem.objects.get_or_create(title=problem_data["title"], defaults=problem_data)
            if not _:
                for key, value in problem_data.items():
                    setattr(problem, key, value)
                problem.save()
            problem.tags.set([tag_objs[tag] for tag in tags_for_problem])
            problems.append(problem)

        now = timezone.now()
        for index, problem in enumerate(problems[:8]):
            DSAAttempt.objects.create(
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
            topic, created = DesignTopic.objects.get_or_create(
                title=topic_data["title"], defaults=topic_data
            )
            if not created:
                for key, value in topic_data.items():
                    setattr(topic, key, value)
                topic.save()
            topic.tags.set([tag_objs[tag] for tag in tags_for_topic if tag in tag_objs])

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
            StudySession.objects.get_or_create(date=session_data["date"], defaults=session_data)

        review_items = []
        for problem in problems[:3]:
            review_items.append(
                ReviewItem.objects.get_or_create(
                    item_type=ReviewItem.ItemType.DSA_PROBLEM,
                    ref_id=problem.id,
                    defaults={"next_review_at": now + timedelta(days=1), "interval_days": 2},
                )[0]
            )
        for topic in DesignTopic.objects.all()[:2]:
            review_items.append(
                ReviewItem.objects.get_or_create(
                    item_type=ReviewItem.ItemType.DESIGN_TOPIC,
                    ref_id=topic.id,
                    defaults={"next_review_at": now, "interval_days": 1},
                )[0]
            )

        self.stdout.write(self.style.SUCCESS("Seed data loaded."))
