from __future__ import annotations

import json
import os
from datetime import date, timedelta
from typing import Any, Dict, List

import httpx
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
SERVICE_TOKEN = os.getenv("SERVICE_TOKEN", "")
API_TIMEOUT = float(os.getenv("API_TIMEOUT", "15"))

mcp = FastMCP("PrepStudio")


def _headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if SERVICE_TOKEN:
        headers["X-Service-Token"] = SERVICE_TOKEN
    return headers


def _truncate_value(value: Any, limit: int = 200) -> Any:
    if isinstance(value, str):
        return value if len(value) <= limit else f"{value[:limit]}...[truncated]"
    if isinstance(value, list):
        if len(value) > 10:
            return value[:10] + ["..."]
        return value
    if isinstance(value, dict):
        return {key: _truncate_value(val, limit) for key, val in value.items()}
    return value


def _summarize_input(payload: Dict[str, Any]) -> str:
    try:
        return json.dumps(_truncate_value(payload), ensure_ascii=True)
    except Exception:
        return "<unavailable>"


def _api_request(method: str, path: str, params: Dict[str, Any] | None = None, data: Any = None):
    url = f"{API_BASE_URL}{path}"
    with httpx.Client(timeout=API_TIMEOUT) as client:
        response = client.request(method, url, params=params, json=data, headers=_headers())
    if response.status_code >= 400:
        raise RuntimeError(f"API {method} {path} failed: {response.status_code} {response.text}")
    if not response.text:
        return None
    return response.json()


def _log_audit(tool_name: str, input_summary: str, status: str, error_message: str | None = None) -> None:
    payload = {
        "source": "MCP",
        "tool_name": tool_name,
        "input_summary": input_summary,
        "status": status,
        "error_message": error_message,
    }
    try:
        with httpx.Client(timeout=API_TIMEOUT) as client:
            client.post(
                f"{API_BASE_URL}/api/audit/log",
                json=payload,
                headers=_headers(),
            )
    except Exception:
        pass


def _run_with_audit(tool_name: str, input_payload: Dict[str, Any], func):
    summary = _summarize_input(input_payload)
    try:
        result = func()
        _log_audit(tool_name, summary, "SUCCESS")
        return result
    except Exception as exc:
        _log_audit(tool_name, summary, "FAIL", str(exc))
        raise


def _fetch_dsa_problems(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    data = _api_request("GET", "/api/dsa/problems/", params=params)
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data or []


def _fetch_design_topics(params: Dict[str, Any]) -> List[Dict[str, Any]]:
    data = _api_request("GET", "/api/design/topics/", params=params)
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data or []


def _fetch_due_reviews(days: int) -> List[Dict[str, Any]]:
    return _api_request("GET", "/api/reviews/due", params={"days": days}) or []


def _fetch_analytics(days: int) -> Dict[str, Any]:
    return _api_request("GET", "/api/analytics/summary", params={"days": days}) or {}


def _resolve_review_titles(reviews: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    dsa_titles: List[str] = []
    design_titles: List[str] = []
    for review in reviews:
        ref_id = review.get("ref_id")
        if review.get("item_type") == "DSA_PROBLEM":
            try:
                problem = _api_request("GET", f"/api/dsa/problems/{ref_id}/")
                dsa_titles.append(problem.get("title", f"DSA #{ref_id}"))
            except Exception:
                dsa_titles.append(f"DSA #{ref_id}")
        else:
            try:
                topic = _api_request("GET", f"/api/design/topics/{ref_id}/")
                design_titles.append(topic.get("title", f"Design #{ref_id}"))
            except Exception:
                design_titles.append(f"Design #{ref_id}")
    return {"dsa": dsa_titles, "design": design_titles}


def _compute_weak_areas(summary: Dict[str, Any]) -> List[Dict[str, Any]]:
    weaknesses: List[Dict[str, Any]] = []
    avg_time = summary.get("avg_time_by_difficulty", {})
    for difficulty, minutes in avg_time.items():
        weaknesses.append(
            {"type": "difficulty", "label": f"Difficulty {difficulty}", "score": minutes}
        )

    tags = summary.get("top_tags_by_attempts", [])
    for tag in tags:
        weaknesses.append({"type": "tag", "label": tag.get("tag"), "score": tag.get("count", 0)})

    weaknesses.sort(key=lambda item: item.get("score", 0), reverse=True)
    return weaknesses[:5]


@mcp.tool()
def search_dsa_problems(
    query: str = "",
    tags: List[str] | None = None,
    difficulty_min: int = 1,
    difficulty_max: int = 5,
) -> List[Dict[str, Any]]:
    tags = tags or []

    def _run():
        params: Dict[str, Any] = {
            "search": query,
            "difficulty_min": max(1, min(5, int(difficulty_min))),
            "difficulty_max": max(1, min(5, int(difficulty_max))),
        }
        if tags:
            params["tags"] = ",".join(tags)
        return _fetch_dsa_problems(params)

    return _run_with_audit(
        "search_dsa_problems",
        {
            "query": query,
            "tags": tags,
            "difficulty_min": difficulty_min,
            "difficulty_max": difficulty_max,
        },
        _run,
    )


@mcp.tool()
def get_dsa_problem(problem_id: int) -> Dict[str, Any]:
    def _run():
        problem = _api_request("GET", f"/api/dsa/problems/{problem_id}/")
        attempts = _api_request("GET", f"/api/dsa/problems/{problem_id}/attempts/") or []
        return {"problem": problem, "recent_attempts": attempts[:5]}

    return _run_with_audit("get_dsa_problem", {"problem_id": problem_id}, _run)


@mcp.tool()
def get_weak_areas(days: int = 14) -> List[Dict[str, Any]]:
    def _run():
        summary = _fetch_analytics(days)
        return _compute_weak_areas(summary)

    return _run_with_audit("get_weak_areas", {"days": days}, _run)


@mcp.tool()
def get_due_reviews(days: int = 0) -> List[Dict[str, Any]]:
    def _run():
        return _fetch_due_reviews(days)

    return _run_with_audit("get_due_reviews", {"days": days}, _run)


@mcp.tool()
def create_study_plan(
    days: int = 7,
    minutes_per_day: int = 90,
    focus_mix: Dict[str, float] | None = None,
) -> Dict[str, Any]:
    focus_mix = focus_mix or {"dsa": 0.6, "design": 0.4}

    def _run():
        total_focus = float(focus_mix.get("dsa", 0.6)) + float(focus_mix.get("design", 0.4))
        if total_focus <= 0:
            dsa_ratio = 0.6
            design_ratio = 0.4
        else:
            dsa_ratio = float(focus_mix.get("dsa", 0.6)) / total_focus
            design_ratio = float(focus_mix.get("design", 0.4)) / total_focus

        dsa_minutes = round(minutes_per_day * dsa_ratio)
        design_minutes = max(0, minutes_per_day - dsa_minutes)

        due_reviews = _fetch_due_reviews(days)
        review_titles = _resolve_review_titles(due_reviews)
        weak_areas = _compute_weak_areas(_fetch_analytics(days))

        dsa_backlog = [item.get("title") for item in _fetch_dsa_problems({}) if item.get("title")]
        design_backlog = [
            item.get("title") for item in _fetch_design_topics({}) if item.get("title")
        ]

        dsa_queue = review_titles["dsa"] + dsa_backlog
        design_queue = review_titles["design"] + design_backlog

        plan_days = []
        for day_index in range(max(1, int(days))):
            day_date = date.today() + timedelta(days=day_index)
            dsa_item = dsa_queue[day_index % len(dsa_queue)] if dsa_queue else None
            design_item = design_queue[day_index % len(design_queue)] if design_queue else None

            plan_days.append(
                {
                    "date": day_date.isoformat(),
                    "minutes": minutes_per_day,
                    "dsa": {"minutes": dsa_minutes, "item": dsa_item},
                    "design": {"minutes": design_minutes, "item": design_item},
                    "focus": weak_areas[:2],
                }
            )

        return {
            "days": plan_days,
            "summary": {
                "due_reviews": len(due_reviews),
                "weak_areas": weak_areas,
                "focus_mix": {"dsa": dsa_ratio, "design": design_ratio},
            },
        }

    return _run_with_audit(
        "create_study_plan",
        {"days": days, "minutes_per_day": minutes_per_day, "focus_mix": focus_mix},
        _run,
    )


@mcp.tool()
def add_design_note(topic_id: int, note_markdown: str) -> Dict[str, Any]:
    def _run():
        topic = _api_request("GET", f"/api/design/topics/{topic_id}/")
        existing = topic.get("notes_markdown", "") or ""
        appended = note_markdown.strip()
        combined = f"{existing}\n\n{appended}".strip() if existing else appended
        updated = _api_request(
            "PATCH",
            f"/api/design/topics/{topic_id}/",
            data={"notes_markdown": combined},
        )
        return updated

    return _run_with_audit(
        "add_design_note",
        {"topic_id": topic_id, "note_markdown": note_markdown},
        _run,
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
