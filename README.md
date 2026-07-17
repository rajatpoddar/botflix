# StreamX — Premium Personal Media Streaming

A Netflix-style streaming frontend + secure FastAPI backend that bridges your self-hosted Jellyfin server with a premium, ad-free experience.

![StreamX](https://img.shields.io/badge/StreamX-Premium%20Streaming-7c3aed)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-20232A?logo=react)
![Jellyfin](https://img.shields.io/badge/Jellyfin-00A4DC?logo=jellyfin)

---

## ✨ Features

- **🎬 Netflix-style UI** — Hero section, poster collages, media carousels, top 10 trending
- **🔐 Dual authentication** — Email/password + Google OAuth (JWT session management)
- **📱 PWA ready** — Installable on mobile & desktop, offline fallback page
- **🎥 HLS Streaming** — Segmented video playback with hls.js for fast seeking & resume
- **🔉 Multi-audio tracks** — Switch between audio languages/streams in-player
- **📝 Subtitle support** — Load external/embedded subtitles (VTT via proxy), toggle on/off
- **📥 Offline downloads** — Download videos with progress tracking, play from local blob
- **🔍 Full-text search** — Movies & TV shows across your Jellyfin library
- **📺 TV Shows** — Season & episode browsing with resume position
- **❤️ Watchlist** — Favorite/unfavorite items synced to Jellyfin
- **👤 Profile** — Avatar, subscription status, watch history
- **💰 Subscription payments** — Integrated Razorpay for premium access
- **📧 Email notifications** — Welcome emails, password reset via SMTP (Gmail)
- **📊 Playback tracking** — Resume watching, continue watching row
- **🌙 Mobile gestures** — Swipe left/right to seek, swipe vertical for brightness/volume
- **🔒 Admin-controlled access** — Jellyfin user policies enforced on registration

## Architecture

```
┌─────────────┐     JWT + JF Token     ┌──────────────┐     Admin API Key     ┌──────────────┐
│   React +   │ ───────────────────▶  │   FastAPI +  │ ───────────────────▶ │   Jellyfin   │
│  Tailwind   │                       │  SQLite/PG   │                       │    Server    │
└─────────────┘                       └──────────────┘                       └──────────────┘
       │                                       │
       │  Razorpay Checkout                    │  SMTP (Gmail)
       ▼                                       ▼
  Razorpay API                            Email Service
```

### Proxy Architecture

The backend acts as a secure proxy between the frontend and Jellyfin:
- **Video streaming**: HLS manifests & segments are proxied through the backend (mobile devices never touch Jellyfin directly)
- **Images**: Posters, backdrops proxied with JWT auth for authenticated users, public endpoint for landing page
- **Subtitles**: VTT files proxied through backend with authentication
- **All API calls**: Jellyfin API calls go through backend using user's Jellyfin token

---

## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- A running [Jellyfin](https://jellyfin.org) server
- (Optional) PostgreSQL — SQLite works for development

### 1. Clone & Configure

```bash
git clone <your-repo-url>
cd streamx

# Backend config
cp .env.example backend/.env
# Edit backend/.env with your values (see Configuration section)

# Frontend config
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your values
```

### 2. Run with Docker (recommended)

```bash
docker-compose up --build
```

- Frontend → http://localhost:5173
- Backend API → http://localhost:8000
- API Docs → http://localhost:8000/docs

### 3. Run locally (development)

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Configuration

### Backend (`backend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection | `sqlite+aiosqlite:///./dev.db` or `postgresql+asyncpg://user:pass@localhost:5432/streamx` |
| `SECRET_KEY` | JWT signing key (generate with `openssl rand -hex 32`) | `your-32-byte-hex-string` |
| `JELLYFIN_SERVER_URL` | Your Jellyfin server URL | `http://192.168.1.100:8096` |
| `JELLYFIN_API_KEY` | Jellyfin admin API key | `get from Jellyfin Dashboard → API Keys` |
| `JELLYFIN_LIBRARY_IDS` | Restrict users to specific libraries (optional) | `libid1,libid2` |
| `FRONTEND_URL` | CORS origin (your production domain) | `https://streamx.example.com` |
| `SMTP_HOST` | SMTP server (Gmail recommended) | `smtp.gmail.com` |
| `SMTP_USER` | SMTP email | `your@gmail.com` |
| `SMTP_PASSWORD` | Gmail App Password (16 chars) | `your-16-char-app-password` |
| `APP_URL` | Public app URL (for email links) | `https://streamx.example.com` |
| `RAZORPAY_KEY_ID` | Razorpay live/test key ID | `rzp_live_xxxxxxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | `your-key-secret` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (for sign-in) | `xxxxx.apps.googleusercontent.com` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL (empty = same origin via Vite proxy) | `http://localhost:8000` or empty |
| `VITE_JELLYFIN_URL` | Direct Jellyfin URL for images | `http://192.168.1.100:8096` |
| `VITE_GOOGLE_CLIENT_ID` | Same as backend GOOGLE_CLIENT_ID | `xxxxx.apps.googleusercontent.com` |
| `VITE_RAZORPAY_KEY_ID` | Same as backend RAZORPAY_KEY_ID | `rzp_live_xxxxxxxxxxxxxx` |

---

## 🔐 Google OAuth Setup

Google Sign-In allows users to register/login with their Google account.

### 1. Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client IDs**
5. Application type: **Web application**
6. **Authorized JavaScript origins** — Add ALL domains where the app runs:
   - `http://localhost:5173` (development)
   - `https://streamx.example.com` (production — replace with your domain)
7. Click **Create**, copy the **Client ID** and **Client Secret**

### 2. Configure Environment

```bash
# Backend
GOOGLE_CLIENT_ID=1064701886312-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx

# Frontend
VITE_GOOGLE_CLIENT_ID=1064701886312-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

> **⚠️ Important for Production**: You MUST add your production domain to "Authorized JavaScript origins" in Google Cloud Console. If you don't, Google Sign-In will show an error for users visiting from your production domain (the `localhost` origin only works for local development).

---

## 🎯 Deployment

### Building for Production

**Frontend**
```bash
cd frontend
npm run build
# Output in frontend/dist/ — serve with nginx or similar
```

**Backend**
```bash
cd backend
docker build -t streamx-backend .
docker run -p 8000:8000 --env-file .env streamx-backend
```

### Docker Compose (full stack)

```bash
docker-compose up --build -d
```

The included `docker-compose.yml` builds and runs both services with:
- Backend on port 8000
- Frontend on port 5173 (dev) or served via nginx (production)

---

## 📁 Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + CORS + routers
│   │   ├── config.py            # Pydantic Settings (env-based)
│   │   ├── database.py          # Async SQLAlchemy engine
│   │   ├── models.py            # User ORM (subscription, google_id, avatar_url)
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── security.py          # JWT creation/verification, bcrypt
│   │   ├── jellyfin.py          # Async Jellyfin API client
│   │   ├── dependencies.py      # FastAPI DI (get_current_user)
│   │   ├── email_service.py     # SMTP email sending (welcome, reset)
│   │   ├── razorpay_service.py  # Razorpay subscription integration
│   │   └── routers/
│   │       ├── auth.py          # /auth/* — register, login, google, forgot/reset, subscription
│   │       ├── media.py         # /api/media/* — proxy, HLS, images, subtitles, search, playback
│   │       └── payments.py      # /payments/* — Razorpay create/verify webhook
│   ├── alembic/                 # DB migrations
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   │   ├── manifest.webmanifest # PWA manifest
│   │   ├── favicon.png          # Favicons + PWA icons
│   │   └── robots.txt / sitemap.xml
│   ├── src/
│   │   ├── App.jsx             # Routes (public + protected)
│   │   ├── main.jsx            # Entry point
│   │   ├── index.css           # Tailwind + global styles
│   │   ├── lib/
│   │   │   ├── api.js          # Axios client + all API calls
│   │   │   └── auth.js         # localStorage session helpers
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx  # Auth state (login, register, googleLogin, logout)
│   │   │   └── DownloadContext.jsx  # Download queue + progress tracking
│   │   ├── components/
│   │   │   ├── ui/             # Button, FloatingInput
│   │   │   ├── layout/         # Navbar (profile, downloads, sign out)
│   │   │   ├── media/          # HeroSection, MediaCarousel, MediaCard, PosterCollage
│   │   │   └── player/         # VideoPlayer (custom controls, gestures, subtitles)
│   │   └── pages/
│   │       ├── LandingPage.jsx      # Hero + Top 10 + features + FAQ
│   │       ├── LoginPage.jsx        # Email/password + Google Sign-In
│   │       ├── SignupPage.jsx       # Registration + Google Sign-Up
│   │       ├── HomePage.jsx         # Continue watching + categories + latest
│   │       ├── WatchPage.jsx        # Video player + audio/subtitle tracks
│   │       ├── MovieDetailPage.jsx  # Movie info + similar + download
│   │       ├── ProfilePage.jsx      # Account settings, avatar, subscription
│   │       ├── DownloadsPage.jsx    # Downloading / completed / failed
│   │       └── ... (15+ pages)
│   ├── Dockerfile
│   └── nginx.conf
│
├── docker-compose.yml
└── .env.example
```

---

## 📡 API Endpoints

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Create account (PostgreSQL + Jellyfin) |
| POST | `/auth/login` | — | Authenticate, get JWT + Jellyfin token |
| POST | `/auth/google` | — | Google OAuth sign-in/sign-up |
| POST | `/auth/forgot-password` | — | Send reset email (user-enum-safe) |
| POST | `/auth/reset-password` | — | Verify token, update password + sync Jellyfin |
| GET | `/auth/subscription` | JWT | Current subscription status |
| POST | `/auth/subscription/activate` | JWT | Activate paid subscription |

### Media

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/media/landing` | Public | Landing page data (collage + trending) |
| GET | `/api/media/latest` | JWT | Recently added items |
| GET | `/api/media/items` | JWT | Paginated item list with filters |
| GET | `/api/media/item/{id}` | JWT | Single item metadata (streams, genres, etc.) |
| GET | `/api/media/search?query=` | JWT | Full-text search |
| GET | `/api/media/proxy-stream/{id}` | JWT (query) | Video stream proxy |
| GET | `/api/media/hls/{id}/main.m3u8` | JWT (query) | HLS manifest proxy |
| GET | `/api/media/subtitles/{id}/{index}` | JWT (query) | VTT subtitle proxy |
| GET | `/api/media/image/{id}` | JWT (query) | Image proxy (posters, backdrops) |
| POST | `/api/media/playback/progress` | JWT | Report playback position |
| POST | `/api/media/playback/stop` | JWT | Persist resume position |
| GET | `/api/media/download-url/{id}` | JWT | Direct download URL |

### Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/create-subscription` | JWT | Create Razorpay subscription |
| POST | `/payments/verify` | JWT | Verify payment signature |

---

## 📄 License

Private — All rights reserved.

---

## 🙏 Acknowledgments

- [Jellyfin](https://jellyfin.org) — The open-source media server
- [hls.js](https://github.com/video-dev/hls.js) — HLS playback in the browser
- [Razorpay](https://razorpay.com) — Payment processing
- [Google Identity Services](https://developers.google.com/identity/gsi/web) — OAuth sign-in
