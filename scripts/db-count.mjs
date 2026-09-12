import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const [users, clients, tasks, deals, departments] = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.task.count(),
    prisma.deal.count(),
    prisma.department.count(),
  ]);
  console.log(JSON.stringify({ users, clients, tasks, deals, departments }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
