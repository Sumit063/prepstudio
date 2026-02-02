from __future__ import annotations

import json
import os
from typing import Any

from server import (
    add_design_note,
    create_study_plan,
    get_dsa_problem,
    get_due_reviews,
    get_weak_areas,
    search_dsa_problems,
    _fetch_design_topics,
)


def _print(title: str, payload: Any) -> None:
    print(f"\n=== {title} ===")
    print(json.dumps(payload, indent=2)[:2000])


def main() -> None:
    print("Running MCP direct demo (calls tool functions without stdio client).")

    problems = search_dsa_problems(query="Two", tags=[], difficulty_min=1, difficulty_max=5)
    _print("search_dsa_problems", problems)

    if problems:
        detail = get_dsa_problem(problem_id=problems[0]["id"])
        _print("get_dsa_problem", detail)

    reviews = get_due_reviews(days=0)
    _print("get_due_reviews", reviews)

    weak_areas = get_weak_areas(days=14)
    _print("get_weak_areas", weak_areas)

    plan = create_study_plan(days=3, minutes_per_day=60, focus_mix={"dsa": 0.6, "design": 0.4})
    _print("create_study_plan", plan)

    if os.getenv("RUN_MUTATIONS") == "1":
        topics = _fetch_design_topics({})
        if topics:
            updated = add_design_note(topics[0]["id"], "Demo note added via MCP tool.")
            _print("add_design_note", updated)
        else:
            print("No design topics found; skipping add_design_note.")
    else:
        print("Skipping add_design_note (set RUN_MUTATIONS=1 to enable).")


if __name__ == "__main__":
    main()
