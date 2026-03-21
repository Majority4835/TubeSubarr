import { ContentType, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { ensureChannelViews, getCanonicalChannelPath, removeChannelViews, slugifyChannelName, ensureDir } from './storageService.js';
import { enqueueJob } from '../workers/jobQueue.js';
import { triggerLibraryRefresh } from './jellyfinService.js';

export const subscriptionInclude = {
  assignments: { include: { user: true } },
  videos: { orderBy: { createdAt: 'desc' as const }, take: 5 },
};

type CreateSubscriptionInput = {
  name: string;
  url: string;
  contentType: ContentType;
  contentFilter: 'all' | 'podcast_only' | 'exclude_podcasts';
  backlogCount: number;
  watchedPolicy: 'keep' | 'delete_immediate' | 'delete_after_delay' | 'delete_after_days';
  watchedDelayHours: number;
  unwatchedPolicy: 'keep' | 'delete_immediate' | 'delete_after_delay' | 'delete_after_days';
  unwatchedDays: number;
  keepIfPlaylisted: boolean;
  keepIfPinned: boolean;
  isActive: boolean;
  userIds: string[];
};

export async function listSubscriptions() {
  return prisma.channel.findMany({
    include: subscriptionInclude,
    orderBy: { name: 'asc' },
  });
}

export async function createSubscription(input: CreateSubscriptionInput) {
  const { userIds, ...channelData } = input;
  const slug = slugifyChannelName(input.name);
  const canonicalPath = getCanonicalChannelPath(input.contentType, slug);
  await ensureDir(canonicalPath);

  const channel = await prisma.channel.create({
    data: {
      ...channelData,
      slug,
      canonicalPath,
      assignments: {
        create: userIds.map((userId) => ({ userId })),
      },
    },
    include: { assignments: { include: { user: true } } },
  });

  await ensureChannelViews(input.contentType, slug, channel.assignments.map((a) => a.user.name), canonicalPath);
  await enqueueJob('poll_channel', { channelId: channel.id });
  await triggerLibraryRefresh();
  return channel;
}

export async function updateSubscription(id: string, input: Prisma.ChannelUpdateInput & { userIds?: string[] }) {
  const existing = await prisma.channel.findUniqueOrThrow({
    where: { id },
    include: { assignments: { include: { user: true } } },
  });

  const { userIds, ...channelData } = input;

  if (userIds) {
    await prisma.channelAssignment.deleteMany({ where: { channelId: id } });
    await prisma.channelAssignment.createMany({ data: userIds.map((userId) => ({ channelId: id, userId })) });
  }

  const updated = await prisma.channel.update({
    where: { id },
    data: channelData,
    include: { assignments: { include: { user: true } } },
  });

  await removeChannelViews(existing.contentType, existing.slug, existing.assignments.map((a) => a.user.name));
  await ensureChannelViews(updated.contentType, updated.slug, updated.assignments.map((a) => a.user.name), updated.canonicalPath);
  await triggerLibraryRefresh();
  return updated;
}

export async function deleteSubscription(id: string) {
  const existing = await prisma.channel.findUniqueOrThrow({
    where: { id },
    include: { assignments: { include: { user: true } } },
  });
  await prisma.channel.delete({ where: { id } });
  await removeChannelViews(existing.contentType, existing.slug, existing.assignments.map((a) => a.user.name));
  await triggerLibraryRefresh();
}
