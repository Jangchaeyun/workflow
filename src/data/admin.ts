import 'server-only';

import { startOfMonth, startOfYear, subDays } from 'date-fns';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { PAGE_SIZE, ROLES, type Role } from '@/lib/constants';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type PermissionKey } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// 회원 · 직원
// ---------------------------------------------------------------------------

export interface UserFilters {
  q?: string;
  role?: string;
  status?: string;
  department?: string;
  sort?: string;
  page?: string;
}

function buildUserWhere(filters: UserFilters): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [{ deletedAt: null }];

  if (filters.q?.trim()) {
    const keyword = filters.q.trim();
    conditions.push({
      OR: [
        { name: { contains: keyword } },
        { email: { contains: keyword } },
        { employeeNo: { contains: keyword } },
        { position: { contains: keyword } },
        { phone: { contains: keyword } },
      ],
    });
  }

  if (filters.role) conditions.push({ role: filters.role });
  if (filters.status) conditions.push({ status: filters.status });
  if (filters.department === 'none') conditions.push({ departmentId: null });
  else if (filters.department) conditions.push({ departmentId: filters.department });

  return { AND: conditions };
}

function buildUserOrderBy(sort?: string): Prisma.UserOrderByWithRelationInput[] {
  switch (sort) {
    case 'name':
      return [{ name: 'asc' }];
    case 'hire':
      return [{ hireDate: 'desc' }, { createdAt: 'desc' }];
    case 'login':
      return [{ lastLoginAt: 'desc' }];
    case 'oldest':
      return [{ createdAt: 'asc' }];
    default:
      return [{ createdAt: 'desc' }];
  }
}

export async function getUserList(filters: UserFilters) {
  const where = buildUserWhere(filters);
  const page = Math.max(1, Number(filters.page ?? 1) || 1);

  const [total, rows, statusGroups, roleGroups] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: buildUserOrderBy(filters.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        employeeNo: true,
        position: true,
        phone: true,
        hireDate: true,
        avatarColor: true,
        lastLoginAt: true,
        createdAt: true,
        departmentId: true,
        managerId: true,
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        _count: {
          select: {
            assignedTasks: { where: { deletedAt: null, status: { not: 'DONE' } } },
            ownedClients: { where: { deletedAt: null } },
            ownedDeals: { where: { deletedAt: null } },
          },
        },
      },
    }),
    // 상태·역할 탭 건수는 해당 필터를 뺀 조건으로 센다.
    prisma.user.groupBy({
      by: ['status'],
      where: buildUserWhere({ ...filters, status: undefined }),
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ['role'],
      where: buildUserWhere({ ...filters, role: undefined }),
      _count: { _all: true },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      status: row.status,
      employeeNo: row.employeeNo,
      position: row.position,
      phone: row.phone,
      hireDate: row.hireDate,
      avatarColor: row.avatarColor,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      departmentId: row.departmentId,
      departmentName: row.department?.name ?? null,
      managerId: row.managerId,
      managerName: row.manager?.name ?? null,
      openTaskCount: row._count.assignedTasks,
      clientCount: row._count.ownedClients,
      dealCount: row._count.ownedDeals,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    statusCounts: Object.fromEntries(statusGroups.map((row) => [row.status, row._count._all])),
    roleCounts: Object.fromEntries(roleGroups.map((row) => [row.role, row._count._all])),
  };
}

/** 직원 관리 화면 상단 요약 (승인 대기 건수는 배지로 노출한다) */
export async function getUserOverview() {
  const monthStart = startOfMonth(new Date());

  const [total, pending, suspended, joinedThisMonth] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.user.count({ where: { deletedAt: null, status: 'PENDING' } }),
    prisma.user.count({ where: { deletedAt: null, status: 'SUSPENDED' } }),
    prisma.user.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } }),
  ]);

  return { total, pending, suspended, joinedThisMonth };
}

/** 직원 등록·수정 폼 선택 목록 */
export async function getUserFormOptions() {
  const [departments, managers] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, status: 'ACTIVE', role: { in: ['ADMIN', 'MANAGER'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, position: true },
    }),
  ]);

  return { departments, managers };
}

// ---------------------------------------------------------------------------
// 부서
// ---------------------------------------------------------------------------

export async function getDepartmentList() {
  const [departments, wonByDepartment] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        users: {
          where: { deletedAt: null },
          orderBy: [{ role: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            role: true,
            status: true,
            position: true,
            avatarColor: true,
          },
        },
      },
    }),
    // 부서별 수주 실적은 부서 소속 담당자의 수주 금액을 합쳐서 낸다.
    prisma.deal.findMany({
      where: { deletedAt: null, stage: 'WON', closedAt: { gte: startOfYear(new Date()) } },
      select: { amount: true, owner: { select: { departmentId: true } } },
    }),
  ]);

  const revenueByDepartment = new Map<string, number>();
  for (const deal of wonByDepartment) {
    const key = deal.owner.departmentId;
    if (!key) continue;
    revenueByDepartment.set(key, (revenueByDepartment.get(key) ?? 0) + deal.amount);
  }

  return departments.map((department) => ({
    id: department.id,
    name: department.name,
    code: department.code,
    description: department.description,
    costCenter: department.costCenter,
    createdAt: department.createdAt,
    members: department.users,
    activeCount: department.users.filter((user) => user.status === 'ACTIVE').length,
    wonAmountThisYear: revenueByDepartment.get(department.id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// 권한 매트릭스
// ---------------------------------------------------------------------------

export interface PermissionMatrixState {
  /** `${role}:${permission}` 형태의 허용 키 집합 */
  allowed: string[];
  /** 기본값과 달라진 항목 수 (관리자에게 커스터마이즈 여부를 알려준다) */
  customizedCount: number;
}

export async function getPermissionMatrixState(): Promise<PermissionMatrixState> {
  const rows = await prisma.rolePermission.findMany({
    select: { role: true, permission: true, allowed: true },
  });

  // 저장된 값이 없으면 기본 정책이 곧 현재 정책이다.
  const allowed = new Set<string>();
  if (rows.length === 0) {
    for (const role of ROLES) {
      for (const permission of DEFAULT_ROLE_PERMISSIONS[role]) {
        allowed.add(`${role}:${permission}`);
      }
    }
    return { allowed: [...allowed], customizedCount: 0 };
  }

  const known = new Set<string>(ALL_PERMISSIONS);
  for (const row of rows) {
    if (!row.allowed || !known.has(row.permission)) continue;
    allowed.add(`${row.role}:${row.permission}`);
  }

  let customizedCount = 0;
  for (const role of ROLES) {
    const defaults = new Set<PermissionKey>(DEFAULT_ROLE_PERMISSIONS[role]);
    for (const permission of ALL_PERMISSIONS) {
      if (defaults.has(permission) !== allowed.has(`${role}:${permission}`)) customizedCount += 1;
    }
  }

  return { allowed: [...allowed], customizedCount };
}

/** 역할별 인원수. 권한을 바꿀 때 영향 범위를 함께 보여주기 위해 쓴다. */
export async function getRoleMemberCounts(): Promise<Record<Role, number>> {
  const groups = await prisma.user.groupBy({
    by: ['role'],
    where: { deletedAt: null, status: 'ACTIVE' },
    _count: { _all: true },
  });

  return Object.fromEntries(
    ROLES.map((role) => [role, groups.find((group) => group.role === role)?._count._all ?? 0]),
  ) as Record<Role, number>;
}

// ---------------------------------------------------------------------------
// 활동 로그
// ---------------------------------------------------------------------------

export interface LogFilters {
  q?: string;
  action?: string;
  entity?: string;
  user?: string;
  /** 7 | 30 | 90 (일) */
  range?: string;
  page?: string;
}

const LOG_PAGE_SIZE = 30;

function buildLogWhere(filters: LogFilters): Prisma.ActivityLogWhereInput {
  const conditions: Prisma.ActivityLogWhereInput[] = [];

  if (filters.q?.trim()) {
    const keyword = filters.q.trim();
    conditions.push({
      OR: [{ summary: { contains: keyword } }, { entityId: { contains: keyword } }],
    });
  }

  if (filters.action) conditions.push({ action: filters.action });
  if (filters.entity) conditions.push({ entityType: filters.entity });
  if (filters.user) conditions.push({ userId: filters.user });

  const days = Number(filters.range);
  if (Number.isFinite(days) && days > 0) {
    conditions.push({ createdAt: { gte: subDays(new Date(), days) } });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getActivityLogs(filters: LogFilters) {
  const where = buildLogWhere(filters);
  const page = Math.max(1, Number(filters.page ?? 1) || 1);

  const [total, rows, actionGroups, entityGroups, actors] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * LOG_PAGE_SIZE,
      take: LOG_PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        detail: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { id: true, name: true, avatarColor: true, role: true } },
      },
    }),
    prisma.activityLog.groupBy({
      by: ['action'],
      where: buildLogWhere({ ...filters, action: undefined }),
      _count: { _all: true },
    }),
    prisma.activityLog.groupBy({
      by: ['entityType'],
      where: buildLogWhere({ ...filters, entity: undefined }),
      _count: { _all: true },
    }),
    // 필터 드롭다운에 넣을 실제 활동 기록이 있는 사용자만 모은다.
    prisma.user.findMany({
      where: { deletedAt: null, activityLogs: { some: {} } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      ...row,
      // detail 은 JSON 문자열로 저장돼 있어 화면에서 쓰기 좋게 파싱해 넘긴다.
      changes: parseChanges(row.detail),
    })),
    total,
    page,
    pageSize: LOG_PAGE_SIZE,
    actionCounts: Object.fromEntries(actionGroups.map((row) => [row.action, row._count._all])),
    entityTypes: entityGroups
      .map((row) => ({ value: row.entityType, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    actors,
  };
}

export interface LogChange {
  field: string;
  before: unknown;
  after: unknown;
}

function parseChanges(detail: string | null): LogChange[] | null {
  if (!detail) return null;

  try {
    const parsed = JSON.parse(detail) as Record<string, unknown>;
    const entries = Object.entries(parsed).filter(
      ([, value]) =>
        value !== null && typeof value === 'object' && 'before' in value && 'after' in value,
    );

    if (entries.length === 0) return null;

    return entries.map(([field, value]) => {
      const change = value as { before: unknown; after: unknown };
      return { field, before: change.before, after: change.after };
    });
  } catch {
    return null;
  }
}

/** 로그 화면 상단 요약: 최근 7일 활동량과 접근 거부 발생 건수 */
export async function getLogOverview() {
  const weekAgo = subDays(new Date(), 7);

  const [weekTotal, denied, loginCount, activeActors] = await Promise.all([
    prisma.activityLog.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.activityLog.count({
      where: { createdAt: { gte: weekAgo }, action: 'ACCESS_DENIED' },
    }),
    prisma.activityLog.count({ where: { createdAt: { gte: weekAgo }, action: 'LOGIN' } }),
    prisma.activityLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: weekAgo }, userId: { not: null } },
    }),
  ]);

  return { weekTotal, denied, loginCount, activeActorCount: activeActors.length };
}

/** 부서 삭제 전 소속 인원 확인 */
export async function countDepartmentMembers(departmentId: string): Promise<number> {
  return prisma.user.count({ where: { departmentId, deletedAt: null } });
}
