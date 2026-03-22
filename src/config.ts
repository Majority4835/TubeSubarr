import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const resolve = (value: string, fallback: string) => path.resolve(process.cwd(), value || fallback);

export const config = {
  port: Number(process.env.PORT || 4000),
  storeRoot: resolve(process.env.STORE_ROOT || './data/store', './data/store'),
  viewRoot: resolve(process.env.VIEW_ROOT || './data/views', './data/views'),
  trashRoot: resolve(process.env.TRASH_ROOT || './data/trash', './data/trash'),
  jellyfinBaseUrl: process.env.JELLYFIN_BASE_URL || 'http://localhost:8096',
  jellyfinApiKey: process.env.JELLYFIN_API_KEY || '',
  ytdlpBinary: process.env.YTDLP_BINARY || 'yt-dlp',
  channelPollIntervalMs: Number(process.env.CHANNEL_POLL_INTERVAL_MS || 300_000),
  jellyfinSyncIntervalMs: Number(process.env.JELLYFIN_SYNC_INTERVAL_MS || 300_000),
  cleanupIntervalMs: Number(process.env.CLEANUP_INTERVAL_MS || 3_600_000),
  trashRetentionHours: Number(process.env.TRASH_RETENTION_HOURS || 24),
};
