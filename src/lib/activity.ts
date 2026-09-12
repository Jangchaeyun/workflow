import 'server-only';

import { headers } from 'next/headers';
import { prisma } from './db';
import type { LogAction } from './constants';

interface LogInput {
  userId?: string | null;
  action: LogAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  detail?: unknown;
}

/**
 * 감사 로그 기록.
 *
 * 로그 실패가 본 트랜잭션을 되돌리면 안 되므로 예외를 삼킨다.
 * 변경 내역은 `diff()` 로 만든 before/after 스냅샷을 JSON 문자열로 보관한다.
 */
export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  summary,
  detail,
}: LogInput): Promise<void> {
  try {
    const headerList = await headers();

    await prisma.activityLog.create({
      data: {
        userId: userId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        summary,
        detail: detail === undefined ? null : JSON.stringify(detail),
        ipAddress:
          headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          headerList.get('x-real-ip') ??
          null,
        userAgent: headerList.get('user-agent'),
      },
    });
  } catch {
    // 로깅 실패는 조용히 무시한다.
  }
}

/** 변경된 필드만 골라 before/after 쌍으로 만든다. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};

  for (const [key, next] of Object.entries(after)) {
    const prev = before[key];
    const normalize = (value: unknown) =>
      value instanceof Date ? value.toISOString() : (value ?? null);

    if (normalize(prev) !== normalize(next)) {
      changes[key] = { before: normalize(prev), after: normalize(next) };
    }
  }

  return changes;
}
