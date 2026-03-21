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
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
