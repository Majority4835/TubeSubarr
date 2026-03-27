import { prisma } from '../db.js';

export async function listVideos() {
  return prisma.video.findMany({
    include: { channel: true },
    where: { deletedAt: null },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function updateVideo(id: string, input: { isPinned?: boolean; isInPlaylist?: boolean; isWatched?: boolean; jellyfinItemId?: string }) {
  return prisma.video.update({
    where: { id },
    data: {
      ...input,
      watchedAt: input.isWatched ? new Date() : undefined,
    },
    include: { channel: true },
  });
}
