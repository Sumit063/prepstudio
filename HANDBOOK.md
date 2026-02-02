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

## Phase 1 - UI shell
### Why
- Establish the visual system and layout early to validate UX before wiring API calls.
- Create reusable UI primitives so later phases can focus on data flows instead of styling.

### What
- Implemented fixed sidebar, top header with breadcrumbs, theme toggle, and profile menu.
- Added UI primitives (Card, Button, Input, Select, Table, Dialog, Tabs, Tooltip).
- Built static pages for Dashboard, DSA list/detail, System Design, Reviews, and Study Sessions with mock data.

### How
- Used Tailwind utility classes tied to CSS variables for strict color system compliance.
- Leveraged Radix UI primitives for Dialog, DropdownMenu, Tabs, and Tooltip wrappers.
- Kept pages static with in-memory mock data to avoid backend calls in Phase 1.
