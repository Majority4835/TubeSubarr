import { prisma } from '../db.js';
import { probeChannel } from '../services/ytdlpService.js';
import { enqueueJob, registerJobHandler } from './jobQueue.js';

function matchesChannelFilters(channel: any, entry: { title: string; webpage_url?: string }) {
  if (!channel.includeShorts && entry.webpage_url?.includes('/shorts/')) return false;
  if (channel.titleFilter && !entry.title.toLowerCase().includes(channel.titleFilter.toLowerCase())) return false;
  return true;
}

registerJobHandler('poll_channel', async ({ channelId }) => {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
  if (!channel.isActive) return;

  const unwatchedCount = await prisma.video.count({ where: { channelId: channel.id, isWatched: false, deletedAt: null } });
  if (channel.pauseDownloadsThreshold && unwatchedCount >= channel.pauseDownloadsThreshold) {
    return;
  }

  const hasTrackedVideos = await prisma.video.count({ where: { channelId: channel.id } });
  if (channel.downloadOnlyNewVideos && !channel.lastPolledAt && hasTrackedVideos === 0) {
    await prisma.channel.update({ where: { id: channel.id }, data: { lastPolledAt: new Date() } });
    return;
  }

  const entries = await probeChannel(channel.url, Math.max(channel.backlogCount, 10));
  for (const entry of entries) {
    if (!matchesChannelFilters(channel, entry)) continue;
    const video = await prisma.video.upsert({
      where: { channelId_sourceVideoId: { channelId: channel.id, sourceVideoId: entry.id } },
      update: { title: entry.title },
      create: {
        channelId: channel.id,
        sourceVideoId: entry.id,
        title: entry.title,
      },
    });

    if (!video.downloadedAt) {
      await enqueueJob('download_video', { videoId: video.id, videoUrl: entry.webpage_url || `${channel.url}/videos` });
    }
  }

  await prisma.channel.update({ where: { id: channel.id }, data: { lastPolledAt: new Date() } });
});

export async function scheduleChannelPolling() {
  const channels = await prisma.channel.findMany({ where: { isActive: true }, select: { id: true } });
  await Promise.all(channels.map((channel) => enqueueJob('poll_channel', { channelId: channel.id })));
}
