# HANDBOOK

## Purpose
A running log of decisions, tradeoffs, and implementation notes for PrepStudio.

## Phase 0 - Scaffolding
### Why
- Establish the repository layout early to keep phase work isolated and easy to navigate.
- Set up tooling (Vite + Tailwind, Django + DRF, MCP server) to reduce friction in later phases.

### What
- Added base repo structure with `backend/`, `frontend/`, and `mcp_server/`.
- Initialized React + TypeScript frontend (Vite) and Tailwind configuration.
- Created Django project skeleton and requirements.
- Added MCP server folder with minimal requirements placeholder.
- Added `.env.example` files and a starter README.

### How
- Used Vite template for React + TS to keep the frontend consistent and minimal.
- Wired Tailwind with class-based dark mode and CSS variables for the color system.
- Created Django project files manually to avoid relying on local package availability.
