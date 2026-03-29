import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { registerJobHandler } from './jobQueue.js';
import { triggerLibraryRefresh } from '../services/jellyfinService.js';

function shouldDelete(video: any) {
  const channel = video.channel;
  if (video.deletedAt || !video.filePath) return false;
  if (channel.keepIfPinned && video.isPinned) return false;
  if (channel.keepIfPlaylisted && video.isInPlaylist) return false;

  const now = Date.now();
  if (video.isWatched) {
    if (channel.watchedPolicy === 'delete_immediate') return true;
    if (channel.watchedPolicy === 'delete_after_delay' && video.watchedAt) {
      return now - new Date(video.watchedAt).getTime() >= channel.watchedDelayHours * 3600000;
    }
  } else if (channel.unwatchedPolicy === 'delete_after_days' && video.publishedAt) {
    return now - new Date(video.publishedAt).getTime() >= channel.unwatchedDays * 86400000;
  }

  return false;
}

registerJobHandler('cleanup_video', async () => {
  const videos = await prisma.video.findMany({ include: { channel: true }, where: { deletedAt: null } });
  await fs.mkdir(config.trashRoot, { recursive: true });

  for (const video of videos) {
    if (!shouldDelete(video)) continue;
    const target = path.join(config.trashRoot, path.basename(video.filePath!));
    await fs.rename(video.filePath!, target);
    await prisma.video.update({ where: { id: video.id }, data: { pendingDeletionAt: new Date(), deletedAt: new Date(), filePath: target } });
  }

  const trashFiles = await fs.readdir(config.trashRoot).catch(() => []);
  const cutoff = Date.now() - config.trashRetentionHours * 3600000;
  for (const file of trashFiles) {
    const fullPath = path.join(config.trashRoot, file);
    const stat = await fs.stat(fullPath);
    if (stat.mtimeMs < cutoff) {
      await fs.rm(fullPath, { force: true });
    }
  }

  await triggerLibraryRefresh();
});
