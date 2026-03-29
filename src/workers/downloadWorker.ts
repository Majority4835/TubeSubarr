import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db.js';
import { triggerLibraryRefresh } from '../services/jellyfinService.js';
import { downloadVideo, fetchVideoMetadata } from '../services/ytdlpService.js';
import { registerJobHandler } from './jobQueue.js';

registerJobHandler('download_video', async ({ videoId, videoUrl }) => {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId }, include: { channel: true } });
  await downloadVideo(videoUrl, video.channel.canonicalPath);
  const files = await fs.readdir(video.channel.canonicalPath);
  const matched = files.find((file) => file.includes(video.sourceVideoId));
  const filePath = matched ? path.join(video.channel.canonicalPath, matched) : null;
  const metadata = await fetchVideoMetadata(videoUrl);

  await prisma.video.update({
    where: { id: videoId },
    data: {
      title: metadata.title,
      description: metadata.description,
      thumbnailUrl: metadata.thumbnail,
      durationSeconds: metadata.duration,
      publishedAt: metadata.upload_date ? new Date(`${metadata.upload_date.slice(0, 4)}-${metadata.upload_date.slice(4, 6)}-${metadata.upload_date.slice(6, 8)}T00:00:00Z`) : undefined,
      downloadedAt: new Date(),
      filePath,
    },
  });

  await triggerLibraryRefresh();
});
