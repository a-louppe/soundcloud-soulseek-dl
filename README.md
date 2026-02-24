# SoundCloud Soulseek DL

A web app that fetches your SoundCloud likes, searches for them on Soulseek (via [slskd](https://github.com/slskd/slskd)), provides yt-dlp fallback downloads, and generates Beatport/Bandcamp search links — all from a real-time Angular UI.

## How It Works

```
SoundCloud Likes → Soulseek search (slskd REST API) → download best match
                                                    ↘ yt-dlp fallback (YouTube)
                                                    ↘ Beatport / Bandcamp search links
```

The backend polls slskd's REST API and streams status updates to the browser in real time via Server-Sent Events (SSE). Track state is stored in SQLite so progress survives restarts.

---

## Prerequisites

| Dependency | Why |
|---|---|
| **Node.js ≥ 20** | Runtime for the backend and build tools |
| **Docker** | Runs slskd (the Soulseek daemon) as a container |
| **yt-dlp** | Fallback downloader when no Soulseek match is found |

---

## Installation

```bash
git clone <repo-url>
cd soundcloud-soulseek-dl
npm install
```

Then create your environment file and fill in your credentials:

```bash
cp .env.example .env   # or create .env from scratch — see Configuration below
```

---

## Configuration (`.env`)

```env
# --- slskd (Soulseek daemon) ---
SLSKD_URL=http://localhost:5030
SLSKD_API_KEY=your-slskd-api-key          # shared between this app and the Docker container

# --- Soulseek account (used by the slskd Docker container) ---
SLSKD_SLSK_USERNAME=your-soulseek-username
SLSKD_SLSK_PASSWORD=your-soulseek-password

# --- SoundCloud ---
SOUNDCLOUD_OAUTH_TOKEN=OAuth 2-0-xxxxxxxx...
SOUNDCLOUD_USER_ID=123456789

# --- Paths ---
DOWNLOAD_DIR=./downloads
DATABASE_PATH=./data/tracks.db
YTDLP_PATH=yt-dlp

# --- Server (optional) ---
PORT=3000
```

Each variable is described in detail below.

---

## Getting Your API Keys

### 1. slskd — `SLSKD_URL`, `SLSKD_API_KEY`, `SLSKD_SLSK_USERNAME`, `SLSKD_SLSK_PASSWORD`

[slskd](https://github.com/slskd/slskd) is a headless Soulseek client with a REST API. This project ships a `docker-compose.yml` that runs it for you.

**Start slskd:**

```bash
docker compose up -d
```

This starts slskd on port `5030` and persists its data in `./slskd-data/`.

**Configure `.env`:**

All slskd configuration is driven from your `.env` file — no YAML editing needed. The Docker Compose file reads `SLSKD_API_KEY`, `SLSKD_SLSK_USERNAME`, and `SLSKD_SLSK_PASSWORD` directly from `.env` and passes them as environment variables into the container.

```env
SLSKD_URL=http://localhost:5030
SLSKD_API_KEY=any-long-random-string       # you choose this; must match in .env and docker-compose.yml
SLSKD_SLSK_USERNAME=your-soulseek-username
SLSKD_SLSK_PASSWORD=your-soulseek-password
```

You can generate a strong API key with:

```bash
openssl rand -hex 20
```

> **Why do you need a Soulseek account?** The Soulseek network requires authentication — slskd logs in on your behalf to perform searches and initiate downloads. Register free at [slsk.org](http://www.slsk.org/).

> **Why environment variables instead of the web UI?** slskd's config file (`slskd.yml`) is a fully-commented template — YAML ignores comments, so the web UI saves credentials into commented-out lines that slskd never reads. Environment variables bypass this entirely and are applied at container startup before any config file parsing.

---

### 2. SoundCloud — `SOUNDCLOUD_OAUTH_TOKEN` and `SOUNDCLOUD_USER_ID`

SoundCloud doesn't offer a self-service API for personal use. Instead, you capture the OAuth token your browser already uses when you're logged in.

> **Why is this approach necessary?** SoundCloud's developer API has been restricted and requires application approval for new projects. Capturing the browser token lets you access your own data without going through that process.

**Step-by-step:**

1. Open [soundcloud.com](https://soundcloud.com) and log in.
2. Open browser DevTools (`F12` or `Ctrl+Shift+I`).
3. Go to the **Network** tab.
4. Refresh the page or click anything (e.g., play a track or open your likes).
5. In the Network tab, filter by `XHR` or search for `api-v2.soundcloud.com`.
6. Click any request to `api-v2.soundcloud.com`.
7. In the **Request Headers**, find the `Authorization` header. Its value looks like:

   ```
   OAuth 2-0-xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

8. Copy the **full value** including the `OAuth ` prefix — that's your `SOUNDCLOUD_OAUTH_TOKEN`.

**Get your User ID:**

In the same Network tab, look at the URL of requests — they often contain your user ID directly, e.g.:

```
https://api-v2.soundcloud.com/users/123456789/track_likes
```

Alternatively, click a request and look at the response JSON for a `user_id` or `id` field.

```env
SOUNDCLOUD_OAUTH_TOKEN=OAuth 2-0-xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SOUNDCLOUD_USER_ID=123456789
```

> **Token expiry:** SoundCloud tokens expire after some time. If the sync stops working, repeat these steps to get a fresh token.

---

### 3. yt-dlp — `YTDLP_PATH`

[yt-dlp](https://github.com/yt-dlp/yt-dlp) is used as a fallback when a track can't be found on Soulseek. It searches YouTube and downloads the best audio match.

**Install yt-dlp:**

On Linux/macOS:
```bash
# Using pip
pip install yt-dlp

# Or download the binary directly
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod +x /usr/local/bin/yt-dlp
```

On Windows:
```powershell
winget install yt-dlp
# or download yt-dlp.exe from https://github.com/yt-dlp/yt-dlp/releases
```

If `yt-dlp` is on your `PATH`, the default value works:

```env
YTDLP_PATH=yt-dlp
```

If you placed the binary in a custom location, provide the full path:

```env
YTDLP_PATH=/opt/tools/yt-dlp
```

---

### 4. `DOWNLOAD_DIR` and `DATABASE_PATH`

These are local filesystem paths — no credentials needed.

```env
# Where downloaded audio files are saved
DOWNLOAD_DIR=./downloads

# SQLite database file (stores track state, search results, downloads)
DATABASE_PATH=./data/tracks.db
```

Both directories are created automatically on startup if they don't exist.

---

## Running the App

**Development (hot reload for both server and UI):**

```bash
npm run dev
```

- Backend (Fastify): `http://localhost:3000`
- Frontend (Angular): `http://localhost:4200`

The Angular dev server proxies all `/api` requests to the backend, so you only need to open port 4200 in your browser.

**Server only:**

```bash
npm run dev:server
```

**Production build:**

```bash
npm run build
```

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `Missing required environment variable` | `.env` is missing or incomplete | Copy `.env.example`, fill in all values |
| `slskd API error: 401` | Wrong or missing `SLSKD_API_KEY` | Check the key in slskd Settings → API Keys |
| `slskd API error: connection refused` | slskd container isn't running | Run `docker compose up -d`, check logs with `docker logs slskd` |
| slskd won't connect to Soulseek | Missing or wrong Soulseek credentials | Check `SLSKD_SLSK_USERNAME` / `SLSKD_SLSK_PASSWORD` in `.env`, then `docker compose up -d --force-recreate` |
| SoundCloud sync returns 0 tracks | Expired or wrong OAuth token | Re-capture the token from browser DevTools |
| yt-dlp download fails | Binary not found or wrong path | Run `yt-dlp --version` to verify it works |
| Port 3000 already in use | Another process is bound to the port | Run `fuser -k 3000/tcp` (Linux) to free it |