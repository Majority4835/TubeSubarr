# TubSubarr

TubSubarr is a self-hosted Node.js + TypeScript MVP for managing YouTube channel subscriptions, downloading videos with `yt-dlp`, exposing per-user Jellyfin views via symlinks, and applying cleanup rules.

## What changed in this refactor

- The home page is now subscription-first: one smart search/add bar at the top and subscribed channels below it.
- Channel names come from YouTube metadata, not manual entry.
- Search results temporarily replace the subscriptions list and preserve the current query.
- Channel-level settings are hidden behind an inline settings panel per subscription card.
- App-wide defaults now live on a dedicated settings page and are applied to newly created channels.

## Project structure

```text
.
├── docker/
│   └── entrypoint.sh
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── public/              # Smart-bar UI, subscriptions view, app defaults view
│   ├── routes/              # REST API routes
│   ├── services/            # Metadata lookup, settings, storage, Jellyfin, yt-dlp
│   ├── workers/             # Queue + poll/download/sync/cleanup workers
│   ├── app.ts
│   ├── config.ts
│   ├── db.ts
│   └── server.ts
├── Dockerfile
├── docker-compose.yml
├── docker-stack.yml
└── .env.example
```

## API

Existing API:

- `GET /subscriptions`
- `POST /subscriptions`
- `PATCH /subscriptions/:id`
- `DELETE /subscriptions/:id`
- `GET /videos`
- `PATCH /videos/:id`
- `POST /webhooks/jellyfin`

Added for the new UX:

- `POST /subscriptions/resolve` — classify smart-bar input and return channel/search/video metadata.
- `GET /subscriptions/:id/videos` — load videos for one subscribed channel.
- `GET /settings`
- `PATCH /settings`

## New defaults + per-channel settings

### App defaults

- include/skip shorts
- min/max video length
- keep-after-watched behavior
- unwatched retention
- default search result limit
- default podcast title keywords
- default podcast min/max length rules
- pause downloads when unwatched count exceeds a threshold

### Per-channel settings

- download only new videos
- optional title filter
- include YouTube Shorts
- keep after watched
- unwatched retention period
- per-channel pause-download threshold override
- media type toggles for Music / Show / Podcast
- podcast title keyword rules
- podcast min/max episode length rules

## Migration notes

Run Prisma schema sync again because the schema now includes:

- a new `AppSettings` table for global defaults
- new channel metadata fields (`avatarUrl`, `summary`)
- new per-channel workflow fields (`downloadOnlyNewVideos`, `titleFilter`, `includeShorts`, `keepAfterWatched`, `unwatchedRetentionDays`, `pauseDownloadsThreshold`, and podcast/media flags)

```bash
npx prisma db push
npm run seed
```

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

### Docker Compose

```bash
docker compose up --build
```

### Docker Stack / Swarm

```bash
docker build -t tubsubarr:local .
docker stack deploy -c docker-stack.yml tubsubarr
```

## Notes

- The current search implementation uses `yt-dlp` metadata resolution and `ytsearch`-based discovery.
- The queue remains intentionally lightweight for MVP scope.
- The main page no longer renders a global downloaded-videos list; videos only appear inside expanded channel cards.
