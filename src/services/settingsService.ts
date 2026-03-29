import { prisma } from '../db.js';

const APP_SETTINGS_ID = 'default';

export async function getAppSettings() {
  const settings = await prisma.appSettings.findUnique({ where: { id: APP_SETTINGS_ID } });
  if (settings) return settings;

  return prisma.appSettings.create({
    data: {
      id: APP_SETTINGS_ID,
      includeShortsDefault: false,
      keepAfterWatchedDefault: true,
      unwatchedRetentionDaysDefault: 30,
      searchResultLimitDefault: 10,
      podcastTitleKeywordsDefault: 'podcast,episode,interview',
      podcastMinLengthSecondsDefault: 900,
      pauseDownloadsThresholdDefault: 50,
    },
  });
}

export async function updateAppSettings(input: {
  includeShortsDefault?: boolean;
  minVideoLengthSecondsDefault?: number | null;
  maxVideoLengthSecondsDefault?: number | null;
  keepAfterWatchedDefault?: boolean;
  unwatchedRetentionDaysDefault?: number;
  searchResultLimitDefault?: number;
  podcastTitleKeywordsDefault?: string;
  podcastMinLengthSecondsDefault?: number | null;
  podcastMaxLengthSecondsDefault?: number | null;
  pauseDownloadsThresholdDefault?: number | null;
}) {
  await getAppSettings();
  return prisma.appSettings.update({
    where: { id: APP_SETTINGS_ID },
    data: input,
  });
}
