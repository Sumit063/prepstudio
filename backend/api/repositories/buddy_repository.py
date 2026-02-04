from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q

from api.models import BuddyRelationship


def get_user_by_identifier(identifier: str):
    User = get_user_model()
    identifier = identifier.strip()
    if not identifier:
        return None
    if "@" in identifier:
        return User.objects.filter(email__iexact=identifier).first()
    return User.objects.filter(username__iexact=identifier).first()


def find_relationship(user_a, user_b):
    return BuddyRelationship.objects.filter(
        Q(requester=user_a, addressee=user_b) | Q(requester=user_b, addressee=user_a)
    ).first()


def list_relationships(user):
    return BuddyRelationship.objects.filter(Q(requester=user) | Q(addressee=user)).select_related(
        "requester", "addressee"
    )


def list_accepted_buddies(user):
    relationships = BuddyRelationship.objects.filter(
        Q(requester=user) | Q(addressee=user),
        status=BuddyRelationship.Status.ACCEPTED,
    ).select_related("requester", "addressee")

    buddies = []
    for relation in relationships:
        buddy = relation.addressee if relation.requester_id == user.id else relation.requester
        buddies.append(buddy)
    return buddies


def count_accepted_buddies(user) -> int:
    return BuddyRelationship.objects.filter(
        Q(requester=user) | Q(addressee=user),
        status=BuddyRelationship.Status.ACCEPTED,
    ).count()
