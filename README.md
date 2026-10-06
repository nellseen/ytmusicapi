# Sonora Music - Full-Stack iOS Glassmorphism Music Web App

Sonora is a modern full-stack music streaming web application built with a premium iOS-inspired Glassmorphism user interface and powered by real YouTube Music data.

## Features

- **No Official API Key or Google Sign-In Required**: Powered by `ytmusicapi` and `yt-dlp` with zero user authentication roadblocks.
- **Real YouTube Music Discovery**:
  - Live search for Songs, Artists, Albums, and Videos.
  - Home feed featuring Trending Charts, New Releases, and Curated Shelves.
  - Rich Artist pages with top tracks, discography (albums & singles), and similar artists.
  - Complete Album tracklists with track numbers, durations, and album covers.
- **Global Music Player**:
  - Persistent bottom player across desktop and mobile.
  - HTML5 audio engine with seamless integrated player backup.
  - Controls: Play/Pause, Seek scrubber, Previous, Next, Shuffle, Repeat (Off, All, One), Volume & Mute.
  - MediaSession API integration for native lock screen / OS notification media controls.
- **Real-Time Lyrics (Synced & Plain)**:
  - Synchronized karaoke-style scrolling lyrics from LRCLIB with interactive click-to-seek.
  - Plain lyrics fallback from official YouTube Music data.
  - Clear "Lyrics unavailable" message when not found.
- **Interactive Queue**:
  - Temporary up-next queue management.
  - Add to queue, Play next, Remove from queue, Clear queue.
- **Favorites & Listening History**:
  - Saved to local storage with one-click access in Library.
- **Design & Responsiveness**:
  - iOS-style dark Glassmorphism with translucent blurred cards, subtle borders, and smooth micro-interactions.
  - Responsive layout for desktop (sidebar + main + player) and mobile (header + mini player + bottom navigation).

---

## Architecture

```text
Frontend (React + Vite + TypeScript + Tailwind CSS)
       ↓
Backend API (Python FastAPI + Uvicorn + httpx)
       ↓
ytmusicapi / yt-dlp / FFmpeg
       ↓
YouTube Music
```

---

## Requirements

- **Node.js**: v18.0.0 or higher
- **Python**: 3.10 or higher
- **FFmpeg**: 4.4 or higher
- **Package Managers**: `npm` and `pip`

---

## Installation & Setup

### 1. System Dependencies (FFmpeg & Python)

On Ubuntu/Debian:
```bash
sudo apt update
sudo apt install -y python3 python3-pip ffmpeg
```

On macOS:
```bash
brew install python ffmpeg
```

On Windows:
- Install Python from [python.org](https://www.python.org/)
- Install FFmpeg using `winget install Gyan.FFmpeg` or `choco install ffmpeg`

---

### 2. Backend Setup (FastAPI)

1. Navigate to the project root:
```bash
cd project
```

2. Create and activate a Python virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install backend dependencies:
```bash
pip install -r backend/requirements.txt
```

4. Run the FastAPI backend:
```bash
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 5000 --reload
```

The backend API will be available at `http://127.0.0.1:5000`.

---

### 3. Frontend Setup (React + Vite)

1. In another terminal window:
```bash
npm install
```

2. Start the Vite development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000` with `/api` proxying requests to `http://127.0.0.1:5000`.

3. To build and run in production:
```bash
npm run build
npm start
```

---

## API Documentation

All endpoints return JSON in the following standard format:

Success:
```json
{
  "success": true,
  "data": { ... }
}
```

Error:
```json
{
  "success": false,
  "error": "Human readable error message"
}
```

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check endpoint |
| `GET` | `/api/home` | Home shelves, trending picks, and new releases |
| `GET` | `/api/trending` | Top charts and popular artists worldwide |
| `GET` | `/api/search?q={query}&filter={filter}` | Search songs, artists, albums, or videos |
| `GET` | `/api/search/songs?q={query}` | Search songs only |
| `GET` | `/api/search/artists?q={query}` | Search artists only |
| `GET` | `/api/search/albums?q={query}` | Search albums only |
| `GET` | `/api/search/videos?q={query}` | Search music videos only |
| `GET` | `/api/song/{video_id}` | Song details, metadata, and related tracks |
| `GET` | `/api/song/{video_id}/stream` | Direct audio stream URL redirect (307) |
| `GET` | `/api/song/{video_id}/lyrics` | Synced / plain lyrics with timestamps |
| `GET` | `/api/artist/{artist_id}` | Artist profile, top songs, discography, and related |
| `GET` | `/api/artist/{artist_id}/songs` | Complete song catalog of an artist |
| `GET` | `/api/artist/{artist_id}/albums` | Complete albums discography of an artist |
| `GET` | `/api/album/{album_id}` | Full album metadata and tracklist |
| `GET` | `/api/related/{video_id}` | Algorithmic related songs / recommendations |

---

## Troubleshooting

- **Audio doesn't play**:
  - The app includes a dual-engine fallback system. If your server IP is in a datacenter blocked by YouTube's bot detection, the player automatically uses client-side streaming seamlessly.
- **Port 5000 is occupied**:
  - Terminate existing processes on port 5000: `fuser -k 5000/tcp` (Linux) or run uvicorn on another port and adjust the proxy in `vite.config.ts`.
