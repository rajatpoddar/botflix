# 🎬 StreamX

A beautiful, Netflix-style streaming interface for your **personal Jellyfin media server**. Think of it like **Plex** or **Emby** — but open-source and fully customizable.

![StreamX](https://img.shields.io/badge/StreamX-Free-red)
![Jellyfin](https://img.shields.io/badge/Powered%20by-Jellyfin-dc2626)

---

## ✨ Features

- 🎥 **Stream from your Jellyfin server** — Movies, TV shows, and more
- 📱 **Responsive design** — Works on desktop, tablet, and mobile
- ▶️ **HLS streaming** — Fast seeking and resume playback
- 🔍 **Search** — Full-text search across your entire library
- 📋 **Watchlist** — Save favorites and track what to watch next
- 📥 **Downloads** — Download for offline viewing
- 🎯 **Resume playback** — Pick up where you left off on any device
- 🎵 **Audio track switching** — Select different audio streams
- 💬 **Subtitle support** — VTT subtitles via your Jellyfin server

## 🚀 Quick Start

### Prerequisites

- A [Jellyfin](https://jellyfin.org) media server running and accessible
- Node.js 18+ and Python 3.12+
- Docker (optional, for containerized deployment)

### Running with Docker (recommended)

```bash
git clone https://github.com/rajatpoddar/StreamX.git
cd StreamX
cp .env.example .env
# Edit .env with your Jellyfin server details and other config
docker compose up --build -d
```

### Running locally

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Configure your Jellyfin server
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Visit `http://localhost:5173` to start streaming!

## 🔧 Configuration

The app connects to your personal Jellyfin server. You'll need to set up:

1. **Jellyfin Server URL** — Where your Jellyfin instance runs
2. **Jellyfin API Key** — Generate one in Jellyfin Dashboard → API Keys
3. **SMTP settings** — For welcome emails and password resets (optional)

All configuration is done through the `.env` file. See `.env.example` for all available options.

## 🏗️ Architecture

```
StreamX/
├── frontend/        # React + Vite + Tailwind CSS
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── pages/        # Route pages
│       ├── contexts/     # Auth, Download contexts
│       └── lib/          # API client, auth helpers
├── backend/         # FastAPI + SQLAlchemy + Jellyfin API
│   └── app/
│       ├── routers/      # API endpoints (auth, media)
│       ├── models.py     # Database models
│       ├── schemas.py    # Pydantic schemas
│       └── jellyfin.py   # Jellyfin API client
```

## 🖥️ Screenshots

> *Coming soon — screenshots of the interface*

## 📝 License

This project is open-source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 🙏 Acknowledgments

- [Jellyfin](https://jellyfin.org) — The amazing open-source media server
- [nregabot.com](https://nregabot.com) — Original community partner

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/rajatpoddar">Rajat Poddar</a>
</p>
