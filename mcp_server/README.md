# PrepStudio MCP Server

MCP server exposing safe tools over the PrepStudio REST API. This runs as a separate process and communicates via stdio.

## Requirements
- Python 3.10+
- Backend API running (`/api/*` endpoints available)

## Setup
```bash
cd mcp_server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Environment
Set these variables before running:
- `API_BASE_URL` (default: `http://127.0.0.1:8000`)
- `SERVICE_TOKEN` (shared secret used as request header `X-Service-Token`)
- `API_TIMEOUT` (optional, seconds)

## Run
```bash
python server.py
```

## Tools
- `search_dsa_problems(query="", tags=[], difficulty_min=1, difficulty_max=5)`
  - Returns DSA problems matching query/tags and difficulty range.
- `get_dsa_problem(problem_id)`
  - Returns a problem and recent attempts.
- `get_weak_areas(days=14)`
  - Uses analytics to summarize top weaknesses.
- `get_due_reviews(days=0)`
  - Returns due reviews up to the given day offset.
- `create_study_plan(days=7, minutes_per_day=90, focus_mix={"dsa":0.6,"design":0.4})`
  - Generates a simple study plan using due reviews, weak areas, and backlog.
- `add_design_note(topic_id, note_markdown)`
  - Appends a note to a design topic and persists it via the API.

## Audit logging
Every tool call posts to `/api/audit/log` with:
- `source = MCP`
- `tool_name`
- `input_summary` (sanitized)
- `status` and optional `error_message`
