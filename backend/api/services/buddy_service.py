from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied, ValidationError

from api.models import BuddyRelationship
from api.repositories.buddy_repository import (
    count_accepted_buddies,
    find_relationship,
    get_user_by_identifier,
    list_relationships,
)

MAX_BUDDIES = 2


def serialize_user(user) -> dict:
    name = f"{user.first_name} {user.last_name}".strip() or user.username
    last_active = user.last_login or user.date_joined
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "name": name,
        "avatarUrl": "",
        "last_active_at": last_active.isoformat() if last_active else None,
    }


def serialize_relationship(user, relationship: BuddyRelationship) -> dict:
    is_requester = relationship.requester_id == user.id
    buddy = relationship.addressee if is_requester else relationship.requester
    direction = "outgoing" if relationship.status == BuddyRelationship.Status.PENDING and is_requester else "incoming"
    if relationship.status == BuddyRelationship.Status.ACCEPTED:
        direction = "accepted"
    return {
        "id": relationship.id,
        "status": relationship.status,
        "direction": direction,
        "created_at": relationship.created_at.isoformat(),
        "updated_at": relationship.updated_at.isoformat(),
        "buddy": serialize_user(buddy),
    }


def list_buddies(user) -> list[dict]:
    relationships = list_relationships(user)
    return [serialize_relationship(user, relation) for relation in relationships]


def search_users(user, query: str, limit: int = 6) -> list[dict]:
    User = get_user_model()
    query = query.strip()
    if not query:
        return []
    matches = User.objects.filter(
        Q(username__icontains=query) | Q(email__icontains=query)
    ).exclude(id=user.id)[:limit]
    return [serialize_user(match) for match in matches]


def request_buddy(user, identifier: str) -> dict:
    target = get_user_by_identifier(identifier)
    if target is None:
        raise ValidationError("User not found.")
    if target.id == user.id:
        raise ValidationError("You cannot add yourself.")

    if count_accepted_buddies(user) >= MAX_BUDDIES:
        raise ValidationError("Buddy limit reached.")

    existing = find_relationship(user, target)
    if existing:
        if existing.status == BuddyRelationship.Status.ACCEPTED:
            raise ValidationError("Buddy already added.")
        if existing.status == BuddyRelationship.Status.PENDING:
            if existing.addressee_id == user.id:
                raise ValidationError("You have a pending request from this user.")
            raise ValidationError("Request already pending.")
        if existing.status == BuddyRelationship.Status.BLOCKED:
            raise ValidationError("Buddy request is blocked.")

    relationship = BuddyRelationship.objects.create(
        requester=user,
        addressee=target,
        status=BuddyRelationship.Status.PENDING,
    )
    return serialize_relationship(user, relationship)


def accept_buddy(user, relationship_id: int) -> dict:
    relationship = BuddyRelationship.objects.select_related("requester", "addressee").filter(
        id=relationship_id
    ).first()
    if not relationship:
        raise ValidationError("Request not found.")
    if relationship.addressee_id != user.id:
        raise PermissionDenied("Not authorized to accept this request.")
    if relationship.status != BuddyRelationship.Status.PENDING:
        raise ValidationError("Request is not pending.")

    if count_accepted_buddies(user) >= MAX_BUDDIES:
        raise ValidationError("Buddy limit reached.")
    if count_accepted_buddies(relationship.requester) >= MAX_BUDDIES:
        raise ValidationError("Buddy has reached their limit.")

    with transaction.atomic():
        relationship.status = BuddyRelationship.Status.ACCEPTED
        relationship.save(update_fields=["status", "updated_at"])

    return serialize_relationship(user, relationship)


def remove_buddy(user, relationship_id: int) -> None:
    relationship = BuddyRelationship.objects.filter(id=relationship_id).first()
    if not relationship:
        raise ValidationError("Relationship not found.")
    if relationship.requester_id != user.id and relationship.addressee_id != user.id:
        raise PermissionDenied("Not authorized to remove this buddy.")
    relationship.delete()
