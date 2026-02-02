# PrepStudio

Resume-friendly fullstack workspace for DSA practice + system design knowledge, analytics, reviews, and an MCP server.

## Project structure
- `/backend` Django + DRF API
- `/frontend` React (Vite) + Tailwind UI
- `/mcp_server` MCP FastMCP server (stdio)

## Status
Phase 2 complete (backend models + API). Phase 1 UI shell merged.

## Product positioning
PrepStudio combines DSA practice and system design knowledge into one workspace. It pairs detailed attempts + notes with design tradeoffs, analytics, and a review queue, then exposes a safe API surface for MCP tools.

### Why it’s different
- One timeline for DSA + design: fewer context switches than separate trackers.
- Analytics-first: time by difficulty, weak tags, design category coverage.
- Spaced repetition built-in across both domains.
- MCP-ready architecture: UI -> REST API -> MCP server boundary for safe tooling.

## Quick start (later phases)
- Backend:
  - `cd backend`
  - `python -m venv .venv` and activate
  - `pip install -r requirements.txt`
  - `python manage.py migrate`
  - `python manage.py seed_prepstudio --reset`
  - `python manage.py runserver`
- Frontend: `cd frontend` then `npm install` and `npm run dev`
- MCP server: `cd mcp_server` then `python server.py`

(Details will be expanded in later phases.)
