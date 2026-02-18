## Style
Use a teaching tone: explain *why* things work, not just *what* to do. Include brief explanations of concepts, trade-offs, and reasoning behind suggestions.


# SoundCloud Soulseek DL

## What This Project Does
Web app that fetches a user's SoundCloud likes, searches for them on Soulseek (via slskd REST API), provides yt-dlp fallback downloads, and generates Beatport/Bandcamp search links. An Angular UI displays all tracks with real-time status updates via SSE.

## Tech Stack
- **Backend**: Node.js + Fastify 5 (TypeScript)
- **Frontend**: Angular 19 + Angular Material (dark theme, standalone components)
- **Database**: SQLite via better-sqlite3 (WAL mode)
- **Real-time**: Server-Sent Events (SSE)
- **Monorepo**: npm workspaces (`packages/shared`, `packages/server`, `packages/client`)

## Project Structure
```
packages/
  shared/     - TypeScript interfaces, enums, DTOs shared between server and client
  server/     - Fastify backend (services, routes, DB, plugins)
  client/     - Angular 19 app (Angular Material, signals state management)
```

## Key Commands
- `npm run dev` - Start both server (tsx watch) and Angular dev server (concurrently)
- `npm run build` - Build shared -> server -> client for production
- `npm run dev:server` - Server only (port 3000)
- `npm run dev:client` - Angular only (port 4200, proxies /api to :3000)

## Configuration
Never divulge personal informations
All config via `.env` file (see `.env.example`):
- `SLSKD_URL` / `SLSKD_API_KEY` - slskd daemon connection
- `SOUNDCLOUD_OAUTH_TOKEN` / `SOUNDCLOUD_USER_ID` - SoundCloud API auth
- `DOWNLOAD_DIR` - Where downloaded tracks are saved
- `DATABASE_PATH` - SQLite database file location
- `YTDLP_PATH` - Path to yt-dlp binary

## Architecture Notes
- **Download manager** (`packages/server/src/services/download-manager.service.ts`) is the central orchestrator. It manages concurrency (max 3 searches, 2 downloads) and emits SSE events.
- **SSE events route** (`packages/server/src/routes/events.routes.ts`) subscribes to download manager's EventEmitter and streams typed events to the Angular client.
- **Track state** is managed with Angular signals in `TrackStateService`, updated reactively from SSE events.
- **Search query cleaning** strips noise from SoundCloud titles (Original Mix, feat., Free Download, etc.) for better Soulseek matches.
- slskd REST API is at `/api/v0/*` with `X-API-Key` header auth.
- Beatport/Bandcamp integration is search-URL generation only (no API scraping).
