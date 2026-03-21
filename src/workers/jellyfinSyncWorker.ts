import { prisma } from '../db.js';
import { fetchItemPlayback } from '../services/jellyfinService.js';
import { registerJobHandler } from './jobQueue.js';

registerJobHandler('jellyfin_sync', async () => {
  const videos = await prisma.video.findMany({ where: { jellyfinItemId: { not: null }, deletedAt: null } });
  for (const video of videos) {
    if (!video.jellyfinItemId) continue;
    const item = await fetchItemPlayback(video.jellyfinItemId);
    if (!item) continue;
    const isWatched = Boolean(item.UserData?.Played);
    await prisma.video.update({
      where: { id: video.id },
      data: {
        isWatched,
        watchedAt: isWatched ? new Date() : null,
      },
    });
  }
});
