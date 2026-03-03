# Copilot Instructions for SoundCloud Soulseek DL

## Project Overview
- **Monorepo**: Uses npm workspaces with three main packages:
  - `packages/shared`: Shared types and API contracts
  - `packages/server`: Fastify backend (TypeScript, SQLite, SSE)
  - `packages/client`: Angular frontend (standalone components, signals)
- **Core Data Flow**: Backend orchestrates downloads and syncs state to the frontend via Server-Sent Events (SSE). State is persisted in SQLite for resilience.
- **slskd Integration**: Communicates with the Soulseek daemon (slskd) via REST API, managed by Docker Compose.

## Key Files & Directories
- `packages/shared/src/models/track.ts`: Core types, especially `TrackStatus`
- `packages/shared/src/api/`: Request/response contracts
- `packages/server/src/app.ts`: App wiring, DI, route registration
- `packages/server/src/services/download-manager.service.ts`: Download orchestration, SSE
- `packages/server/src/routes/`: HTTP API endpoints
- `packages/server/src/db/`: SQLite setup, migrations, repositories
- `packages/client/src/app/core/services/track-state.service.ts`: Client state, SSE handling
- `packages/client/src/app/features/`: UI feature modules

## Developer Workflows
- **Triage**: Run `npm run triage:map` to generate a codebase map for fast navigation
- **Development**: `npm run dev` (full stack, hot reload)
- **Backend only**: `npm run dev:server`
- **Frontend only**: `npm run dev:client`
- **Build**: `npm run build` (all), or `npm run build:shared && npm run build:server`/`client` for partial
- **slskd**: Start with `docker compose up -d` (reads config from `.env`)

## Project Conventions
- **Subagent Pattern**: Use focused agents for triage, backend, frontend, migrations, and regression review (see `CLAUDE.md` for details)
- **Token Efficiency**: Prefer targeted grep/search over full file reads; reuse context, avoid loading large files unless necessary
- **SSE**: All real-time updates use `/api/events/stream` (see backend and client SSE services)
- **Database**: All schema changes via migration files in `packages/server/src/db/migrations/`
- **API**: All endpoints are under `/api/` and defined in `routes/` and `shared/api/`

## Integration Points
- **slskd**: Managed via Docker Compose, config via `.env` (see README)
- **yt-dlp**: Used for YouTube downloads, ensure binary is available
- **SoundCloud**: Uses browser token for API access (see README for capture instructions)

## Examples
- To add a new download source, update `DownloadManager`, add a new service, and expose via `routes/`
- To add a new UI feature, create a feature module in `client/src/app/features/` and connect to state via `track-state.service.ts`

## References
- See `CLAUDE.md` for agent workflow and triage details
- See `README.md` for environment setup, troubleshooting, and integration notes

---

**Keep instructions concise and focused on this codebase's actual patterns and workflows.**
