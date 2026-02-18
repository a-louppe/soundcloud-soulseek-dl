# SoundCloud Soulseek DL - Implementation Plan

## Overview

A web app that fetches SoundCloud likes, searches Soulseek (via slskd), offers yt-dlp fallback downloads, and generates Beatport/Bandcamp search links. Tracks and statuses are displayed in an Angular UI with real-time updates.

## Tech Stack

- **Backend**: Node.js + Fastify (TypeScript)
- **Frontend**: Angular 19 + Angular Material (dark theme)
- **Database**: SQLite via better-sqlite3
- **Real-time**: Server-Sent Events (SSE)
- **Monorepo**: npm workspaces with shared types package

## Project Structure

```
soundcloud-soulseek-dl/
├── package.json                  # Root workspace config
├── tsconfig.base.json
├── .env.example
├── packages/
│   ├── shared/                   # Shared TS types & DTOs
│   │   └── src/
│   │       ├── models/track.ts   # Track, TrackStatus, SoulseekSearchResult, DownloadProgress
│   │       └── api/              # Request/response DTOs
│   ├── server/                   # Fastify backend
│   │   └── src/
│   │       ├── app.ts            # Fastify app setup, plugin registration
│   │       ├── config.ts         # Env schema + validation
│   │       ├── db/
│   │       │   ├── database.ts   # SQLite init (WAL mode), migrations
│   │       │   └── repositories/ # track, search-result, download repos
│   │       ├── services/
│   │       │   ├── soundcloud.service.ts    # OAuth API, paginated likes fetch
│   │       │   ├── slskd.service.ts         # REST API: search, download, status
│   │       │   ├── ytdlp.service.ts         # Child process: yt-dlp with progress parsing
│   │       │   ├── download-manager.service.ts  # Orchestrator + SSE event emitter
│   │       │   └── link-generator.service.ts    # Beatport/Bandcamp URL builders
│   │       ├── routes/
│   │       │   ├── tracks.routes.ts     # CRUD + sync
│   │       │   ├── search.routes.ts     # Single + bulk Soulseek search
│   │       │   ├── downloads.routes.ts  # Soulseek + yt-dlp downloads
│   │       │   └── events.routes.ts     # SSE endpoint
│   │       └── utils/
│   │           ├── search-query.ts      # Clean SoundCloud titles for search
│   │           └── sanitize-filename.ts # Safe filenames
│   └── client/                   # Angular 19 app
│       └── src/app/
│           ├── core/services/
│           │   ├── api.service.ts         # HTTP calls to backend
│           │   ├── sse.service.ts         # EventSource -> typed Observables
│           │   └── track-state.service.ts # Angular signals state management
│           ├── features/
│           │   ├── dashboard/             # Main view: status bar + track list
│           │   ├── track-card/            # Track row with actions
│           │   ├── search-results-dialog/ # Soulseek result picker (MatDialog)
│           │   └── settings/              # Health checks, config display
│           └── shared/components/
│               ├── status-badge/          # Color-coded status chip
│               ├── progress-bar/          # Download progress with speed/ETA
│               └── external-links/        # Beatport + Bandcamp buttons
```

## Data Model

### TrackStatus enum

`pending | searching | found_on_soulseek | not_found | downloading | downloaded | failed`

### SQLite Tables

- **tracks**: id, soundcloud_id (unique), title, artist, artwork_url, soundcloud_url, duration, status, error_message, download_path, download_source, liked_at, created_at, updated_at
- **soulseek_results**: id, track_id (FK), slskd_search_id, username, filename, size, bit_rate, sample_rate, bit_depth, file_extension, queue_length, free_upload_slots, upload_speed
- **active_downloads**: id, track_id (FK), source, slskd_username, slskd_filename, bytes_transferred, total_bytes, state, started_at, completed_at

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tracks` | List tracks (filter by status, sort, paginate) |
| GET | `/api/tracks/:id` | Single track with Soulseek results |
| POST | `/api/tracks/sync` | Fetch SoundCloud likes -> upsert DB (202 + SSE) |
| POST | `/api/search/:trackId` | Search Soulseek for track (202 + SSE) |
| POST | `/api/search/bulk` | Bulk search pending/not_found tracks |
| GET | `/api/search/:trackId/results` | Cached Soulseek results |
| POST | `/api/downloads/soulseek` | Download via slskd { trackId, resultId } |
| POST | `/api/downloads/ytdlp` | Download via yt-dlp { trackId, sourceUrl? } |
| GET | `/api/downloads/active` | Active downloads with progress |
| POST | `/api/downloads/:id/cancel` | Cancel download |
| POST | `/api/downloads/:id/retry` | Retry failed download |
| GET | `/api/events/stream` | SSE endpoint for real-time updates |
| GET | `/api/config/status` | Health: slskd + SoundCloud connectivity |

## SSE Event Types

- `track:status-changed` - status transitions
- `search:progress` - results count, completion
- `download:progress` - bytes, speed, ETA
- `download:complete` - final file path
- `download:failed` - error message
- `sync:complete` - new/total track counts

## Configuration (.env)

```env
SLSKD_URL=http://localhost:5030
SLSKD_API_KEY=
SOUNDCLOUD_OAUTH_TOKEN=
SOUNDCLOUD_USER_ID=
DOWNLOAD_DIR=./downloads
PORT=3000
DATABASE_PATH=./data/tracks.db
YTDLP_PATH=yt-dlp
```

## Implementation Order

### Phase 0: Project Documentation : Done

- Write CLAUDE.md at project root with architecture overview, project structure, tech stack, and key decisions — serves as persistent context for future sessions

### Phase 1: Scaffolding : Done

- Init monorepo (root package.json with workspaces, tsconfig.base.json, .gitignore, .env.example)
- Create packages/shared with Track model, TrackStatus enum, DTOs
- Scaffold Fastify server (app.ts, config.ts, entry point)
- Scaffold Angular app (ng new), add Angular Material, configure API proxy

### Phase 2: Database : Done

- SQLite init with WAL mode + migration runner
- Write migration 001-initial.sql (3 tables)
- Implement track, search-result, download repositories

### Phase 3: Services : Done

- SoundCloud service (paginated likes fetch via OAuth, GET /me/favorites)
- slskd service (search, poll results, enqueue download, check transfer status)
- yt-dlp service (spawn child process, parse progress from stdout)
- Link generator (Beatport/Bandcamp search URL builders)
- Download manager (orchestrator: concurrency queue, SSE event emitter, status transitions)
- Search query builder utility (clean SoundCloud titles for better Soulseek matches)

### Phase 4: Routes : Done

- Tracks routes (list, get, sync, delete)
- Search routes (single, bulk, get results)
- Download routes (soulseek, ytdlp, active, cancel, retry)
- SSE events route (stream endpoint with heartbeat)
- Config/health route
- Wire Fastify plugins, register routes, serve Angular static in production

### Phase 5: Frontend : Done

- Core services (ApiService, SseService, TrackStateService with signals)
- Dashboard component (status summary bar, filters, track list)
- Track card component (artwork, info, status badge, action buttons)
- Search results dialog (Soulseek result table with download action)
- Shared components (status-badge, progress-bar, external-links, pipes)
- Settings component (health checks, download dir info)

### Phase 6: Design System
High-fidelity UI design of a modern desktop music archiver app called 'Deep Sync'. The aesthetic is 'Professional Glassmorphism' mixed with 'Data Terminal'. Dark mode, matte grey frosted glass background, soft diffused lighting. NO NEON, NO GLOW.

Layout: A two-column interface. Left Sidebar: Dark frosted glass containing a vertical list of filter categories (Inbox, Matched, Missing) and a Settings gear icon at the bottom. Main Area: A dense data grid/spreadsheet showing music tracks. Header: Contains a search bar and a dropdown menu labeled "Quality: FLAC". UI Elements:

    Rows: Show Artist, Track Name, and Source.

    Badges: Use matte, desaturated pastel pills for sources (Soft Blue for Soulseek, Soft Green for Beatport).

    Typography: Clean white sans-serif font (Inter).

    Style: Minimalist, expensive feel, 4k resolution, Figma export, Behance style.

### Phase 7: Polish

- Dev scripts (concurrently for server + client)
- Production build (server compiles TS, client ng build, server serves static)
- Error handling (startup checks for yt-dlp, slskd connectivity, token validity)

## Key Design Decisions

- **Fastify over Express**: Better TypeScript support, built-in schema validation, plugin system maps well to service encapsulation
- **SQLite over JSON**: Handles concurrent writes safely (WAL), query/filter/sort natively, scales to 1000s of tracks
- **SSE over WebSocket**: Unidirectional updates (server->client) are all we need; simpler, auto-reconnects, HTTP/2 compatible
- **Concurrency limits**: Max 3 concurrent Soulseek searches, 2 concurrent downloads to avoid overwhelming slskd
- **Search query cleaning**: Strip "(Original Mix)", "feat. X", "[Free Download]" etc. from SoundCloud titles for better Soulseek matches

## Verification
1. Start slskd daemon (Docker or binary)
2. Set .env with valid SoundCloud OAuth token + slskd credentials
3. `npm run dev` starts both server and Angular dev server
4. Click "Sync Likes" -> tracks appear from SoundCloud
5. Click "Search Soulseek" on a track -> results populate after polling
6. Pick a result -> download starts, progress shows via SSE
7. Try yt-dlp fallback on a track not found on Soulseek
8. Verify Beatport/Bandcamp links open correct search pages
9. Refresh page -> state persists from DB, SSE reconnects
