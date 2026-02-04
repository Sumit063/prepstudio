from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from api.models import BuddyRelationship, DSAProblem


class BuddyApiTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="alice", email="alice@example.com", password="password123"
        )
        self.buddy = User.objects.create_user(
            username="bob", email="bob@example.com", password="password123"
        )

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_buddy_request_accept_flow(self):
        self.authenticate(self.user)
        response = self.client.post(
            "/api/buddies/request",
            {"identifier": self.buddy.email},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        relationship_id = response.data["id"]

        self.authenticate(self.buddy)
        response = self.client.post(
            "/api/buddies/accept",
            {"relationship_id": relationship_id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], BuddyRelationship.Status.ACCEPTED)

    def test_merged_problem_detail_includes_buddy_entries(self):
        BuddyRelationship.objects.create(
            requester=self.user,
            addressee=self.buddy,
            status=BuddyRelationship.Status.ACCEPTED,
        )
        user_problem = DSAProblem.objects.create(
            owner=self.user,
            title="Two Sum",
            platform=DSAProblem.Platform.LEETCODE,
            difficulty=2,
            global_key="two-sum",
            solution_notes="User notes",
        )
        DSAProblem.objects.create(
            owner=self.buddy,
            title="Two Sum",
            platform=DSAProblem.Platform.LEETCODE,
            difficulty=2,
            global_key="two-sum",
            solution_notes="Buddy notes",
        )

        self.authenticate(self.user)
        response = self.client.get(f"/api/merged/problems/{user_problem.id}")
        self.assertEqual(response.status_code, 200)
        entries = response.data["entries"]
        owner_ids = {entry["owner"]["id"] for entry in entries}
        self.assertIn(self.user.id, owner_ids)
        self.assertIn(self.buddy.id, owner_ids)
