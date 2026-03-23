import { prisma } from '../db.js';
import { probeChannel } from '../services/ytdlpService.js';
import { enqueueJob, registerJobHandler } from './jobQueue.js';

registerJobHandler('poll_channel', async ({ channelId }) => {
  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
  if (!channel.isActive) return;

  const entries = await probeChannel(channel.url, channel.backlogCount);
  for (const entry of entries) {
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
