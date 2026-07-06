# StreamX — Premium VOD Platform

A Netflix-style streaming frontend + secure FastAPI backend that bridges your self-hosted Jellyfin server.

## Architecture

```
┌─────────────┐     JWT + JF Token     ┌──────────────┐     Admin API Key     ┌──────────────┐
│   React +   │ ───────────────────▶  │   FastAPI +  │ ───────────────────▶ │   Jellyfin   │
│  Tailwind   │                       │  PostgreSQL  │                       │    Server    │
└─────────────┘                       └──────────────┘                       └──────────────┘
```

## Quick Start

### 1. Configure environment

```bash
# Root .env.example covers shared keys
cp .env.example backend/.env

# Edit backend/.env with your real values:
#   DATABASE_URL, SECRET_KEY, JELLYFIN_SERVER_URL, JELLYFIN_API_KEY

cp frontend/.env.example frontend/.env
# Set VITE_JELLYFIN_URL to your Jellyfin base URL
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

Frontend → http://localhost:5173  
Backend API docs → http://localhost:8000/docs

### 3. Run locally (development)

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# start postgres, then:
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + CORS
│   │   ├── config.py        # Pydantic settings
│   │   ├── database.py      # Async SQLAlchemy engine
│   │   ├── models.py        # User ORM model
│   │   ├── schemas.py       # Pydantic request/response schemas
│   │   ├── security.py      # JWT, bcrypt, token generation
│   │   ├── jellyfin.py      # Async Jellyfin API client
│   │   ├── dependencies.py  # FastAPI dependency injection
│   │   └── routers/
│   │       ├── auth.py      # /auth/* endpoints
│   │       └── media.py     # /api/media/* proxy endpoints
│   ├── alembic/             # DB migrations
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.js       # Axios client + all API calls
│   │   │   └── auth.js      # localStorage session helpers
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── components/
│   │   │   ├── ui/          # FloatingInput, Button
│   │   │   ├── layout/      # Navbar
│   │   │   ├── media/       # HeroSection, MediaCarousel, MediaCard
│   │   │   └── player/      # VideoPlayer (custom HTML5 controls)
│   │   └── pages/
│   │       ├── LoginPage.jsx
│   │       ├── SignupPage.jsx
│   │       ├── ForgotPasswordPage.jsx
│   │       ├── HomePage.jsx
│   │       ├── WatchPage.jsx
│   │       └── SearchPage.jsx
│   ├── Dockerfile
│   └── nginx.conf
│
├── docker-compose.yml
└── .env.example
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create account (PostgreSQL + Jellyfin) |
| POST | `/auth/login` | — | Authenticate, get JWT + Jellyfin token |
| POST | `/auth/forgot-password` | — | Generate reset token (mocked email) |
| POST | `/auth/reset-password` | — | Verify token, sync new password to Jellyfin |
| GET | `/api/media/latest` | JWT | Recently added items |
| GET | `/api/media/categories` | JWT | Library views |
| GET | `/api/media/items` | JWT | Paginated item list |
| GET | `/api/media/item/{id}` | JWT | Single item metadata |
| GET | `/api/media/stream-url/{id}` | JWT | Direct stream URL for player |
| GET | `/api/media/search` | JWT | Full-text search |

## Key Design Decisions

- **Dual token flow**: The backend issues its own JWT for stateless API auth, while the Jellyfin AccessToken is passed through to the frontend for direct image/stream URL construction — avoiding a video proxy bottleneck.
- **Password sync**: Both register and reset-password keep PostgreSQL and Jellyfin in sync. If Jellyfin sync fails on reset, the local password is still updated and the error is logged without blocking the user.
- **User enumeration protection**: `forgot-password` always returns 200 regardless of whether the email exists.
- **Restricted Jellyfin users**: New users get a policy with no admin rights, no downloads, and optionally restricted to specific library folders via `JELLYFIN_LIBRARY_IDS`.
