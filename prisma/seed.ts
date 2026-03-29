import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  for (const name of ['Lana', 'Richard', 'Shared']) {
    await prisma.user.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  await prisma.appSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
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

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
