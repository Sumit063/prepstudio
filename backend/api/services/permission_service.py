from __future__ import annotations

from api.repositories.buddy_repository import list_accepted_buddies


def get_buddy_ids(user) -> list[int]:
    return [buddy.id for buddy in list_accepted_buddies(user)]


def can_access_user_content(user, target_user_id: int) -> bool:
    if user.id == target_user_id:
        return True
    return target_user_id in get_buddy_ids(user)
