# PrepStudio

PrepStudio is a high-polish learning workspace that unifies DSA practice, system design notes, analytics, and spaced reviews. It ships with a modern React UI, a Django + DRF backend, and an MCP server boundary for safe tool access.

## Product overview
PrepStudio is designed like an editor for interview prep:
- Track DSA problems with attempts, code snippets, approaches, and workspace notes.
- Maintain a system design knowledge base with tradeoffs, references, and a design canvas.
- Review queue with spaced repetition for both DSA and system design.
- Analytics dashboard for weak areas, time trends, and tag coverage.

## Project structure
- `/backend` Django + DRF API
- `/frontend` React (Vite) + Tailwind UI
- `/mcp_server` MCP FastMCP server (stdio)

## Local development
### Backend
```
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_prepstudio --reset
python manage.py runserver
```

### Frontend
```
cd frontend
npm install
npm run dev
```

### MCP server (optional)
```
cd mcp_server
python server.py
```

## Google OAuth + Calendar (local)
The project supports two Google flows:
1) Login (Google ID token) - frontend only needs VITE_GOOGLE_CLIENT_ID.
2) Calendar sync (OAuth code flow) - backend handles OAuth and event creation.

Backend `.env` (required for calendar):
```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:8000/api/calendar/oauth/callback
GOOGLE_CALENDAR_SCOPES=https://www.googleapis.com/auth/calendar.events
FRONTEND_BASE_URL=http://localhost:5173
```

Frontend `.env` (for login):
```
VITE_GOOGLE_CLIENT_ID=your-client-id
```

In Google Cloud Console:
- Enable Google Calendar API
- Add redirect URI: http://127.0.0.1:8000/api/calendar/oauth/callback
- Add JS origin: http://localhost:5173
- Add yourself as a Test User if the consent screen is not published

## Production deployment
Recommended setup:
- Frontend: Vercel/Netlify (static build)
- Backend: Render/Fly.io/Railway or any Django-capable host
- DB: Postgres for production

Production checklist:
1) Set DEBUG=0, SECRET_KEY, ALLOWED_HOSTS.
2) Use HTTPS and update:
   - FRONTEND_BASE_URL=https://app.yourdomain.com
   - GOOGLE_OAUTH_REDIRECT_URI=https://api.yourdomain.com/api/calendar/oauth/callback
3) Add production origins to CORS_ALLOWED_ORIGINS.
4) Configure Google OAuth client with production JS origins + redirect URI.
5) Run migrations and seed demo data only for demo environments.

## Notes
- No auth is required for core UI in dev, but auth is used for user-scoped data.
- MCP server uses a service token boundary to access the API safely.
