import fs from 'node:fs/promises';
import { config } from './config.js';
import { createApp } from './app.js';
import { prisma } from './db.js';
import { startQueueWorker, enqueueJob } from './workers/jobQueue.js';
import './workers/channelPoller.js';
import './workers/downloadWorker.js';
import './workers/jellyfinSyncWorker.js';
import './workers/cleanupWorker.js';

async function bootstrap() {
  await Promise.all([
    fs.mkdir(config.storeRoot, { recursive: true }),
    fs.mkdir(config.viewRoot, { recursive: true }),
    fs.mkdir(config.trashRoot, { recursive: true }),
  ]);

  startQueueWorker();
  setInterval(() => void enqueueJob('jellyfin_sync', {}), config.jellyfinSyncIntervalMs);
  setInterval(() => void enqueueJob('cleanup_video', {}), config.cleanupIntervalMs);
  setInterval(async () => {
    const channels = await prisma.channel.findMany({ where: { isActive: true }, select: { id: true } });
    await Promise.all(channels.map((channel) => enqueueJob('poll_channel', { channelId: channel.id })));
  }, config.channelPollIntervalMs);

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`TubeSubarr listening on http://localhost:${config.port}`);
  });
}

bootstrap().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
