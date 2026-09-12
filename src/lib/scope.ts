import 'server-only';

import type { Prisma } from '@prisma/client';

import { getCurrentUser, getMyPermissions } from './auth';
import type { PermissionKey } from './permissions';

/**
 * 데이터 조회 범위(스코프) 계산.
 *
 * "전체 조회" 권한이 없는 사용자는 자신과 연관된 레코드만 볼 수 있어야 한다.
 * 화면마다 조건을 흩어놓으면 한 곳만 빠뜨려도 정보가 새므로,
 * Prisma where 절을 만들어 주는 함수로 모아 목록·상세·통계가 모두 재사용한다.
 */
export interface AccessScope {
  userId: string;
  permissions: Set<PermissionKey>;
  canReadAllTasks: boolean;
  canReadAllDeals: boolean;
}

export async function getAccessScope(): Promise<AccessScope> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const permissions = await getMyPermissions();

  return {
    userId: user.id,
    permissions,
    canReadAllTasks: permissions.has('task:read:all'),
    canReadAllDeals: permissions.has('deal:read:all'),
  };
}

/** 업무 조회 범위: 담당자 · 요청자 · 참조자로 걸린 건만 */
export function taskScopeWhere(scope: AccessScope): Prisma.TaskWhereInput {
  if (scope.canReadAllTasks) return {};

  return {
    OR: [
      { assigneeId: scope.userId },
      { reporterId: scope.userId },
      { watchers: { some: { userId: scope.userId } } },
    ],
  };
}

/** 영업건 조회 범위: 본인이 담당한 건만 */
export function dealScopeWhere(scope: AccessScope): Prisma.DealWhereInput {
  if (scope.canReadAllDeals) return {};
  return { ownerId: scope.userId };
}

/**
 * 업무 수정 가능 여부.
 * 전체 수정 권한이 있거나, 본인이 담당/요청한 업무를 수정할 권한이 있는 경우 허용한다.
 */
export function canEditTask(
  scope: AccessScope,
  task: { assigneeId: string | null; reporterId: string },
): boolean {
  if (scope.permissions.has('task:update:all')) return true;
  if (!scope.permissions.has('task:update:own')) return false;
  return task.assigneeId === scope.userId || task.reporterId === scope.userId;
}

/** 업무 상세 열람 가능 여부 (목록 스코프와 동일한 기준) */
export function canViewTask(
  scope: AccessScope,
  task: { assigneeId: string | null; reporterId: string; watchers?: { userId: string }[] },
): boolean {
  if (scope.canReadAllTasks) return true;
  if (task.assigneeId === scope.userId || task.reporterId === scope.userId) return true;
  return Boolean(task.watchers?.some((watcher) => watcher.userId === scope.userId));
}

export function canViewDeal(scope: AccessScope, deal: { ownerId: string }): boolean {
  return scope.canReadAllDeals || deal.ownerId === scope.userId;
}

/**
 * 영업건 수정 가능 여부.
 * 수정 권한이 있어도 조회 범위를 벗어난 남의 영업건은 건드릴 수 없다.
 */
export function canEditDeal(scope: AccessScope, deal: { ownerId: string }): boolean {
  if (!scope.permissions.has('deal:update')) return false;
  return canViewDeal(scope, deal);
}
