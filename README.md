# TubSubarr

TubSubarr is a self-hosted Node.js + TypeScript MVP for managing YouTube or podcast channel subscriptions, downloading new videos with `yt-dlp`, exposing per-user Jellyfin views via symlinks, and applying cleanup rules.

## Project structure

```text
.
├── prisma/
│   ├── schema.prisma        # SQLite schema for users, channels, videos, jobs
│   └── seed.ts              # Seeds local users (Lana, Richard, Shared)
├── src/
│   ├── public/              # Simple subscriptions/videos UI
│   ├── routes/              # REST API routes
│   ├── services/            # Domain services for storage, yt-dlp, Jellyfin
│   ├── workers/             # Queue + poll/download/sync/cleanup workers
│   ├── app.ts               # Express app factory
│   ├── config.ts            # Environment/config loading
│   ├── db.ts                # Prisma client
│   └── server.ts            # Bootstrap + schedulers
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## MVP capabilities

- Multi-user local accounts with separate YouTube and Podcast Jellyfin views.
- Canonical channel storage under `/store/.../channels/<channel-slug>` and user-specific symlinked Jellyfin views under `/views/.../<user>/<channel-slug>`.
- REST API for subscriptions, videos, and Jellyfin webhook ingestion.
- Background workers for channel polling, downloads, Jellyfin watched sync, and cleanup.
- Cleanup rules for watched and stale-unwatched videos with a trash-first delete flow.
- Minimal browser UI for subscriptions and video pin/watch actions.

## Prisma schema highlights

- `User`: local application/Jellyfin user mapping.
- `Channel`: canonical channel subscription and retention settings.
- `ChannelAssignment`: many-to-many user/channel ownership.
- `Video`: download state, Jellyfin item ID, watch state, pin/playlist protection, delete timestamps.
- `Job`: lightweight SQLite-backed job queue.

## API

- `GET /subscriptions`
- `POST /subscriptions`
- `PATCH /subscriptions/:id`
- `DELETE /subscriptions/:id`
- `GET /videos`
- `PATCH /videos/:id`
- `POST /webhooks/jellyfin`

## Run locally

### Node.js

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

Open `http://localhost:4000`.

### Docker

```bash
docker compose up --build
```

The container installs `ffmpeg` and `yt-dlp`, runs `prisma db push`, and starts the server on port `4000`.

## Notes

- Jellyfin libraries should already exist and point to `./data/views/youtube/<user>` and `./data/views/podcasts/<user>`.
- The worker queue is intentionally simple for MVP scope; a production version should use stronger locking and retries.
- `yt-dlp` integration uses child processes and JSON probing/download workflows that can be extended for richer metadata or search.
