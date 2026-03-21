import { JobStatus, JobType } from '@prisma/client';
import { prisma } from '../db.js';

const handlers = new Map<JobType, (payload: any) => Promise<void>>();

export function registerJobHandler(type: JobType, handler: (payload: any) => Promise<void>) {
  handlers.set(type, handler);
}

export async function enqueueJob(type: JobType, payload: Record<string, unknown>, runAfter = new Date()) {
  return prisma.job.create({
    data: { type, payload: JSON.stringify(payload), runAfter },
  });
}

export async function processNextJob() {
  const job = await prisma.job.findFirst({
    where: { status: JobStatus.pending, runAfter: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
  });

  if (!job) return false;

  const handler = handlers.get(job.type);
  if (!handler) return false;

  await prisma.job.update({ where: { id: job.id }, data: { status: JobStatus.running, lockedAt: new Date(), attempts: { increment: 1 } } });

  try {
    await handler(JSON.parse(job.payload));
    await prisma.job.update({ where: { id: job.id }, data: { status: JobStatus.completed } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.failed, lastError: message },
    });
  }

  return true;
}

export function startQueueWorker(intervalMs = 2000) {
  setInterval(async () => {
    let hasMore = true;
    while (hasMore) {
      hasMore = await processNextJob();
    }
  }, intervalMs);
}
