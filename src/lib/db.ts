import { PrismaClient } from '@prisma/client';

// 개발 모드의 HMR 이 매 요청마다 새 커넥션을 만들어 SQLite 를 잠그는 것을 방지한다.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
