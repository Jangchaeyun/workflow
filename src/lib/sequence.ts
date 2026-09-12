import 'server-only';

import { prisma } from './db';

/**
 * 사람이 읽고 부를 수 있는 업무번호(TSK-0001) 생성.
 *
 * 코드가 0 패딩된 고정 길이라 사전순 내림차순 = 번호순 내림차순이 성립한다.
 * 동시 등록으로 충돌하면 유니크 제약에 걸리므로 호출부에서 재시도한다.
 */
async function nextCode(prefix: string, current: string | null): Promise<string> {
  const lastNumber = current ? Number(current.replace(`${prefix}-`, '')) : 0;
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

export async function nextTaskCode(): Promise<string> {
  const last = await prisma.task.findFirst({ orderBy: { code: 'desc' }, select: { code: true } });
  return nextCode('TSK', last?.code ?? null);
}

export async function nextClientCode(): Promise<string> {
  const last = await prisma.client.findFirst({ orderBy: { code: 'desc' }, select: { code: true } });
  return nextCode('CL', last?.code ?? null);
}

export async function nextDealCode(): Promise<string> {
  const last = await prisma.deal.findFirst({ orderBy: { code: 'desc' }, select: { code: true } });
  return nextCode('DL', last?.code ?? null);
}

/** 유니크 충돌(P2002) 시 코드를 다시 계산해 재시도 */
export async function withCodeRetry<T>(create: (code: string) => Promise<T>, generate: () => Promise<string>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await create(await generate());
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string }).code;
      if (code !== 'P2002') throw error;
    }
  }

  throw lastError;
}
