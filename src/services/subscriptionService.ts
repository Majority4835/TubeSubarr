import { ContentType, Prisma, RetentionPolicy } from '@prisma/client';
import { prisma } from '../db.js';
import { ensureChannelViews, getCanonicalChannelPath, removeChannelViews, slugifyChannelName, ensureDir } from './storageService.js';
import { enqueueJob } from '../workers/jobQueue.js';
import { triggerLibraryRefresh } from './jellyfinService.js';
import { fetchChannelMetadata, fetchVideoMetadata } from './ytdlpService.js';
import { getAppSettings } from './settingsService.js';

export const subscriptionInclude = {
  assignments: { include: { user: true } },
  videos: { where: { deletedAt: null }, orderBy: [{ publishedAt: 'desc' as const }, { createdAt: 'desc' as const }], take: 12 },
};

type CreateSubscriptionInput = {
  url: string;
  contentType?: ContentType;
  contentFilter?: 'all' | 'podcast_only' | 'exclude_podcasts';
  backlogCount?: number;
  keepIfPlaylisted?: boolean;
  keepIfPinned?: boolean;
  isActive?: boolean;
  userIds: string[];
  downloadOnlyNewVideos?: boolean;
  titleFilter?: string | null;
  includeShorts?: boolean;
  keepAfterWatched?: boolean;
  unwatchedRetentionDays?: number;
  pauseDownloadsThreshold?: number | null;
  mediaMusic?: boolean;
  mediaShow?: boolean;
  mediaPodcast?: boolean;
  podcastTitleKeywords?: string | null;
  podcastMinLengthSeconds?: number | null;
  podcastMaxLengthSeconds?: number | null;
  seedVideoUrl?: string | null;
};

function watchedPolicyForKeepAfterWatched(keepAfterWatched: boolean): RetentionPolicy {
  return keepAfterWatched ? 'keep' : 'delete_immediate';
}

function nullableString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function buildChannelDefaults(input: CreateSubscriptionInput) {
  const appSettings = await getAppSettings();
  const includeShorts = input.includeShorts ?? appSettings.includeShortsDefault;
  const keepAfterWatched = input.keepAfterWatched ?? appSettings.keepAfterWatchedDefault;
  const unwatchedRetentionDays = input.unwatchedRetentionDays ?? appSettings.unwatchedRetentionDaysDefault;

  return {
    contentType: input.contentType ?? 'youtube',
    contentFilter: input.contentFilter ?? 'all',
    backlogCount: input.backlogCount ?? 15,
    keepIfPlaylisted: input.keepIfPlaylisted ?? true,
    keepIfPinned: input.keepIfPinned ?? true,
    isActive: input.isActive ?? true,
    downloadOnlyNewVideos: input.downloadOnlyNewVideos ?? true,
    titleFilter: nullableString(input.titleFilter),
    includeShorts,
    keepAfterWatched,
    unwatchedRetentionDays,
    pauseDownloadsThreshold: input.pauseDownloadsThreshold ?? appSettings.pauseDownloadsThresholdDefault ?? null,
    mediaMusic: input.mediaMusic ?? false,
    mediaShow: input.mediaShow ?? true,
    mediaPodcast: input.mediaPodcast ?? false,
    podcastTitleKeywords: nullableString(input.podcastTitleKeywords) ?? appSettings.podcastTitleKeywordsDefault,
    podcastMinLengthSeconds: input.podcastMinLengthSeconds ?? appSettings.podcastMinLengthSecondsDefault ?? null,
    podcastMaxLengthSeconds: input.podcastMaxLengthSeconds ?? appSettings.podcastMaxLengthSecondsDefault ?? null,
    watchedPolicy: watchedPolicyForKeepAfterWatched(keepAfterWatched),
    watchedDelayHours: 0,
    unwatchedPolicy: 'delete_after_days' as const,
    unwatchedDays: unwatchedRetentionDays,
  };
}

async function fetchSubscriptionMetadata(inputUrl: string) {
  const videoMetadata = /(watch\?v=|youtu\.be\/|\/shorts\/)/i.test(inputUrl) ? await fetchVideoMetadata(inputUrl) : null;
  if (videoMetadata) {
    return {
      url: videoMetadata.channel_url || videoMetadata.uploader_url || inputUrl,
      sourceId: videoMetadata.channel_id || videoMetadata.uploader_id || videoMetadata.id,
      name: videoMetadata.channel || videoMetadata.uploader || videoMetadata.title,
      avatarUrl: videoMetadata.thumbnail,
      summary: videoMetadata.description || null,
      seedVideoUrl: videoMetadata.webpage_url || inputUrl,
    };
  }

  const channelMetadata = await fetchChannelMetadata(inputUrl);
  return {
    url: channelMetadata.channel_url || channelMetadata.uploader_url || channelMetadata.webpage_url || inputUrl,
    sourceId: channelMetadata.channel_id || channelMetadata.uploader_id || channelMetadata.id || null,
    name: channelMetadata.channel || channelMetadata.uploader || channelMetadata.title,
    avatarUrl: channelMetadata.thumbnail || null,
    summary: channelMetadata.description || channelMetadata.channel_description || null,
    seedVideoUrl: null,
  };
}

export async function listSubscriptions() {
  return prisma.channel.findMany({
    include: subscriptionInclude,
    orderBy: { name: 'asc' },
  });
}

export async function getSubscriptionVideos(id: string) {
  return prisma.video.findMany({
    where: { channelId: id, deletedAt: null },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createSubscription(input: CreateSubscriptionInput) {
  const defaults = await buildChannelDefaults(input);
  const metadata = await fetchSubscriptionMetadata(input.url);
  const slug = slugifyChannelName(metadata.name);
  const canonicalPath = getCanonicalChannelPath(defaults.contentType, slug);
  await ensureDir(canonicalPath);

  const existing = await prisma.channel.findUnique({
    where: { url: metadata.url },
    include: { assignments: { include: { user: true } } },
  });

  if (existing) {
    const missingUserIds = input.userIds.filter((userId) => !existing.assignments.some((assignment) => assignment.userId === userId));
    if (missingUserIds.length > 0) {
      await prisma.channelAssignment.createMany({
        data: missingUserIds.map((userId) => ({ channelId: existing.id, userId })),
      });
    }

    const updatedExisting = await prisma.channel.update({
      where: { id: existing.id },
      data: {
        name: metadata.name,
        sourceId: metadata.sourceId,
        avatarUrl: metadata.avatarUrl,
        summary: metadata.summary,
      },
      include: { assignments: { include: { user: true } } },
    });

    await ensureChannelViews(updatedExisting.contentType, updatedExisting.slug, updatedExisting.assignments.map((a) => a.user.name), updatedExisting.canonicalPath);
    if (input.seedVideoUrl || metadata.seedVideoUrl) {
      await enqueueSpecificVideoDownload(updatedExisting.id, input.seedVideoUrl || metadata.seedVideoUrl!);
    }
    return updatedExisting;
  }

  const channel = await prisma.channel.create({
    data: {
      ...defaults,
      name: metadata.name,
      slug,
      url: metadata.url,
      sourceId: metadata.sourceId,
      avatarUrl: metadata.avatarUrl,
      summary: metadata.summary,
      canonicalPath,
      lastPolledAt: defaults.downloadOnlyNewVideos ? new Date() : null,
      assignments: {
        create: input.userIds.map((userId) => ({ userId })),
      },
    },
    include: { assignments: { include: { user: true } } },
  });

  await ensureChannelViews(channel.contentType, channel.slug, channel.assignments.map((a) => a.user.name), canonicalPath);
  if (input.seedVideoUrl || metadata.seedVideoUrl) {
    await enqueueSpecificVideoDownload(channel.id, input.seedVideoUrl || metadata.seedVideoUrl!);
  } else if (!channel.downloadOnlyNewVideos) {
    await enqueueJob('poll_channel', { channelId: channel.id });
  }
  await triggerLibraryRefresh();
  return channel;
}

async function enqueueSpecificVideoDownload(channelId: string, videoUrl: string) {
  const metadata = await fetchVideoMetadata(videoUrl);
  const video = await prisma.video.upsert({
    where: { channelId_sourceVideoId: { channelId, sourceVideoId: metadata.id } },
    update: {
      title: metadata.title,
      description: metadata.description,
      thumbnailUrl: metadata.thumbnail,
      durationSeconds: metadata.duration,
    },
    create: {
      channelId,
      sourceVideoId: metadata.id,
      title: metadata.title,
      description: metadata.description,
      thumbnailUrl: metadata.thumbnail,
      durationSeconds: metadata.duration,
      publishedAt: metadata.upload_date ? new Date(`${metadata.upload_date.slice(0, 4)}-${metadata.upload_date.slice(4, 6)}-${metadata.upload_date.slice(6, 8)}T00:00:00Z`) : null,
    },
  });

  await enqueueJob('download_video', { videoId: video.id, videoUrl });
}

export async function updateSubscription(id: string, input: Prisma.ChannelUpdateInput & { userIds?: string[] }) {
  const existing = await prisma.channel.findUniqueOrThrow({
    where: { id },
    include: { assignments: { include: { user: true } } },
  });

  const { userIds, ...channelData } = input;
  const normalizedData: Prisma.ChannelUpdateInput = { ...channelData };

  if (channelData.keepAfterWatched === false) {
    normalizedData.watchedPolicy = 'delete_immediate';
  }
  if (channelData.keepAfterWatched === true) {
    normalizedData.watchedPolicy = 'keep';
  }
  if (typeof channelData.unwatchedRetentionDays === 'number') {
    normalizedData.unwatchedPolicy = 'delete_after_days';
    normalizedData.unwatchedDays = channelData.unwatchedRetentionDays;
  }

  if (userIds) {
    await prisma.channelAssignment.deleteMany({ where: { channelId: id } });
    await prisma.channelAssignment.createMany({ data: userIds.map((userId) => ({ channelId: id, userId })) });
  }

  const updated = await prisma.channel.update({
    where: { id },
    data: normalizedData,
    include: { assignments: { include: { user: true } }, videos: subscriptionInclude.videos },
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
