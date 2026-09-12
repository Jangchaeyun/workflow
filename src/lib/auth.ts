import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from './db';
import { SESSION_COOKIE, verifySessionToken } from './session';
import { ROLES, type Role } from './constants';
import {
  ALL_PERMISSIONS,
  buildDefaultMatrix,
  type PermissionKey,
  type PermissionMatrix,
} from './permissions';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: string;
  position: string | null;
  avatarColor: string;
  departmentId: string | null;
  departmentName: string | null;
}

/**
 * 요청 단위로 메모이즈된 세션 조회.
 * 레이아웃 · 페이지 · 서버 액션이 각각 호출해도 DB 왕복은 한 번만 발생한다.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, deletedAt: null },
    include: { department: { select: { name: true } } },
  });

  // 토큰이 유효해도 계정이 정지·퇴사 처리되면 즉시 접근을 끊는다.
  if (!user || user.status !== 'ACTIVE') return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    status: user.status,
    position: user.position,
    avatarColor: user.avatarColor,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** DB에 저장된 역할×권한 매트릭스. 누락된 항목은 기본값으로 채운다. */
export const getPermissionMatrix = cache(async (): Promise<PermissionMatrix> => {
  const rows = await prisma.rolePermission.findMany();

  if (rows.length === 0) return buildDefaultMatrix();

  const matrix = Object.fromEntries(ROLES.map((role) => [role, new Set<PermissionKey>()])) as PermissionMatrix;
  const known = new Set<string>(ALL_PERMISSIONS);

  for (const row of rows) {
    if (!row.allowed) continue;
    if (!known.has(row.permission)) continue;
    const bucket = matrix[row.role as Role];
    if (bucket) bucket.add(row.permission as PermissionKey);
  }

  // 관리자는 매트릭스가 잘못 저장돼도 시스템에서 잠기지 않도록 항상 전 권한을 갖는다.
  matrix.ADMIN = new Set(ALL_PERMISSIONS);

  return matrix;
});

export const getMyPermissions = cache(async (): Promise<Set<PermissionKey>> => {
  const user = await getCurrentUser();
  if (!user) return new Set();
  const matrix = await getPermissionMatrix();
  return matrix[user.role] ?? new Set();
});

export async function can(permission: PermissionKey): Promise<boolean> {
  return (await getMyPermissions()).has(permission);
}

export async function canAny(...permissions: PermissionKey[]): Promise<boolean> {
  const mine = await getMyPermissions();
  return permissions.some((permission) => mine.has(permission));
}

/**
 * 페이지 · 레이아웃 진입 가드.
 * 권한이 없으면 접근 거부 화면으로 보내면서 감사 로그를 남긴다.
 */
export async function requirePermission(permission: PermissionKey): Promise<CurrentUser> {
  const user = await requireUser();
  const mine = await getMyPermissions();

  if (!mine.has(permission)) {
    await prisma.activityLog
      .create({
        data: {
          userId: user.id,
          action: 'ACCESS_DENIED',
          entityType: 'Permission',
          entityId: permission,
          summary: `권한 없는 기능 접근 시도 (${permission})`,
        },
      })
      .catch(() => undefined);

    redirect(`/forbidden?permission=${encodeURIComponent(permission)}`);
  }

  return user;
}

/**
 * 여러 권한 중 하나만 있어도 통과하는 가드.
 * "내 것만 조회"와 "전체 조회"처럼 범위만 다른 권한을 함께 허용할 때 쓴다.
 */
export async function requireAnyPermission(
  ...permissions: PermissionKey[]
): Promise<CurrentUser> {
  const user = await requireUser();
  const mine = await getMyPermissions();

  if (permissions.some((permission) => mine.has(permission))) return user;

  await prisma.activityLog
    .create({
      data: {
        userId: user.id,
        action: 'ACCESS_DENIED',
        entityType: 'Permission',
        entityId: permissions.join('|'),
        summary: `권한 없는 기능 접근 시도 (${permissions.join(', ')})`,
      },
    })
    .catch(() => undefined);

  redirect(`/forbidden?permission=${encodeURIComponent(permissions[0])}`);
}

/** 서버 액션용. redirect 대신 예외를 던져 폼 결과로 메시지를 돌려줄 수 있게 한다. */
export class PermissionError extends Error {
  constructor(permission: PermissionKey) {
    super(`이 작업을 수행할 권한이 없습니다. (${permission})`);
    this.name = 'PermissionError';
  }
}

export async function assertPermission(permission: PermissionKey): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const mine = await getMyPermissions();
  if (!mine.has(permission)) throw new PermissionError(permission);

  return user;
}
