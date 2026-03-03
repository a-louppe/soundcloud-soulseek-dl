## Style
Use a teaching tone: explain why things work, not just what to do. Keep explanations concise by default.

# Claude Operating Guide - SoundCloud Soulseek DL

## Mission
- Deliver safe, minimal, testable changes quickly.
- Optimize token use by reading only relevant code.
- Use subagents for focused work instead of one large context.

## Token Optimization Contract
1. Start with `npm run triage:map`, then use Grep tool for targeted searches before opening files.
2. Read only files you expect to edit plus direct dependencies.
3. Never load entire directories or large files unless the task requires it.
4. Prefer `sed -n 'start,endp'` over full-file reads for large files.
5. Summarize command output; do not paste long logs unless asked.
6. Reuse previously gathered context; do not re-read unchanged files.
7. Keep plans short and execution-focused.
8. Compact early when context grows.

## Subagent Routing
Use these local agents in `.claude/agents`:
- `repo-triage` for fast scope mapping and file shortlist.
- `backend-fastify` for server/service/route changes.
- `frontend-angular` for Angular UI and state changes.
- `sqlite-migrations` for schema and repository updates.
- `regression-reviewer` for final risk and regression pass.

When to skip triage:
- Single-file changes where the target file is already known.
- Typo fixes, small config tweaks, or tasks the user has fully scoped.

Recommended flow for medium/large tasks:
1. `repo-triage` — produces file shortlist and execution order
2. One implementation agent (`backend-fastify` or `frontend-angular` or `sqlite-migrations`) — pass the triage summary so it starts with the right scope
3. `regression-reviewer` — final verification including build check

## High-Value Repo Map
- `packages/shared/src/models/track.ts` - shared core types and `TrackStatus`.
- `packages/shared/src/api/*` - request/response contracts.
- `packages/server/src/app.ts` - app wiring, DI, route registration.
- `packages/server/src/services/download-manager.service.ts` - orchestration, queues, SSE event emission.
- `packages/server/src/routes/*.ts` - HTTP API surface.
- `packages/server/src/db/*` - SQLite init, migrations, repositories.
- `packages/client/src/app/core/services/track-state.service.ts` - client state and SSE handling.
- `packages/client/src/app/features/*` - UI feature modules.

## Runtime Facts
- Monorepo via npm workspaces: `packages/shared`, `packages/server`, `packages/client`.
- Backend: Fastify + TypeScript.
- Frontend: Angular standalone components + signals.
- Database: SQLite (`better-sqlite3`, WAL mode).
- Realtime: SSE at `/api/events/stream`.
- Central orchestrator: `DownloadManager` with queue concurrency limits.

## API Snapshot
- Tracks: list/detail/counts/sync/cancel sync/status update/bulk status/metadata update/delete.
- Search: single track search, bulk search, cached results.
- Downloads: soulseek start, yt-dlp start, active list, cancel, retry.
- Config: `/api/config/status` health and dependency checks.

## Build and Run
- `npm run triage:map` - generate `.claude/cache/codebase-map.{md,json}` for fast triage.
- `npm run dev` - run server + client in development.
- `npm run dev:server` - backend only.
- `npm run dev:client` - frontend only.
- `npm run build` - full workspace build.
- `npm run build:shared && npm run build:server` - backend-focused validation.
- `npm run build:shared && npm run build:client` - frontend-focused validation.

## Change Rules
- Keep edits surgical; follow existing patterns before introducing new abstractions.
- Preserve shared API contracts (`packages/shared`) when changing server/client behavior.
- For background operations, preserve SSE event consistency.
- Avoid adding dependencies unless there is clear, measurable benefit.
- Never expose secrets from `.env` in output, logs, or commits.

## Completion Checklist
1. Relevant build/test command executed.
2. No obvious regression in status transitions or SSE events.
3. Types compile across affected workspaces.
4. Summary includes changed files, behavior impact, and verification performed.

## Mistakes to avoid
1. Using document.querySelector instead of ViewChild
