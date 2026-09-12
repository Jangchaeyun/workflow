import 'server-only';

import { addDays, endOfDay, startOfDay } from 'date-fns';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { getAccessScope, taskScopeWhere, type AccessScope } from '@/lib/scope';
import { PAGE_SIZE, TASK_PRIORITY_WEIGHT, type TaskPriority } from '@/lib/constants';

export interface TaskFilters {
  q?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignee?: string;
  client?: string;
  due?: string;
  sort?: string;
  page?: string;
}

export interface TaskListItem {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  progress: number;
  dueDate: Date | null;
  createdAt: Date;
  commentCount: number;
  attachmentCount: number;
  client: { id: string; name: string } | null;
  assignee: { id: string; name: string; avatarColor: string } | null;
  reporter: { id: string; name: string };
}

/**
 * 업무 검색 조건을 Prisma where 절로 변환한다.
 * 조회 범위(스코프) 조건과 AND 로 합쳐 권한 밖 데이터가 새지 않게 한다.
 */
export function buildTaskWhere(scope: AccessScope, filters: TaskFilters): Prisma.TaskWhereInput {
  const conditions: Prisma.TaskWhereInput[] = [{ deletedAt: null }, taskScopeWhere(scope)];

  if (filters.q) {
    const keyword = filters.q.trim();
    if (keyword) {
      conditions.push({
        OR: [
          { title: { contains: keyword } },
          { code: { contains: keyword } },
          { description: { contains: keyword } },
          { client: { name: { contains: keyword } } },
        ],
      });
    }
  }

  if (filters.status) conditions.push({ status: filters.status });
  if (filters.priority) conditions.push({ priority: filters.priority });
  if (filters.category) conditions.push({ category: filters.category });

  if (filters.assignee === 'none') conditions.push({ assigneeId: null });
  else if (filters.assignee === 'me') conditions.push({ assigneeId: scope.userId });
  else if (filters.assignee) conditions.push({ assigneeId: filters.assignee });

  if (filters.client) conditions.push({ clientId: filters.client });

  const today = startOfDay(new Date());
  if (filters.due === 'today') {
    conditions.push({ status: { not: 'DONE' }, dueDate: { gte: today, lte: endOfDay(today) } });
  } else if (filters.due === 'week') {
    conditions.push({ status: { not: 'DONE' }, dueDate: { not: null, lte: endOfDay(addDays(today, 7)) } });
  } else if (filters.due === 'overdue') {
    conditions.push({ status: { not: 'DONE' }, dueDate: { lt: today } });
  }

  return { AND: conditions };
}

function buildOrderBy(sort?: string): Prisma.TaskOrderByWithRelationInput[] {
  switch (sort) {
    case 'due':
      // SQLite 는 NULLS LAST 를 직접 못 쓰므로 마감일 없는 건은 뒤로 밀리도록 두 단계로 정렬한다.
      return [{ dueDate: 'asc' }, { createdAt: 'desc' }];
    case 'oldest':
      return [{ createdAt: 'asc' }];
    case 'progress':
      return [{ progress: 'desc' }, { createdAt: 'desc' }];
    default:
      return [{ createdAt: 'desc' }];
  }
}

const LIST_SELECT = {
  id: true,
  code: true,
  title: true,
  status: true,
  priority: true,
  category: true,
  progress: true,
  dueDate: true,
  createdAt: true,
  client: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, avatarColor: true } },
  reporter: { select: { id: true, name: true } },
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TaskSelect;

export async function getTaskList(filters: TaskFilters) {
  const scope = await getAccessScope();
  const where = buildTaskWhere(scope, filters);

  const page = Math.max(1, Number(filters.page ?? 1) || 1);

  const [total, rows, statusCounts] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: buildOrderBy(filters.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: LIST_SELECT,
    }),
    // 상태 탭에 표시할 건수. 상태 필터는 제외해야 탭마다 전체 건수가 보인다.
    prisma.task.groupBy({
      by: ['status'],
      where: buildTaskWhere(scope, { ...filters, status: undefined }),
      _count: { _all: true },
    }),
  ]);

  let items: TaskListItem[] = rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    status: row.status,
    priority: row.priority,
    category: row.category,
    progress: row.progress,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    commentCount: row._count.comments,
    attachmentCount: row._count.attachments,
    client: row.client,
    assignee: row.assignee,
    reporter: row.reporter,
  }));

  // 우선순위는 문자열이라 DB 정렬로는 의미 있는 순서가 나오지 않아 애플리케이션에서 정렬한다.
  if (filters.sort === 'priority') {
    items = items.sort(
      (a, b) =>
        TASK_PRIORITY_WEIGHT[a.priority as TaskPriority] -
        TASK_PRIORITY_WEIGHT[b.priority as TaskPriority],
    );
  }

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    statusCounts: Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])),
    scope,
  };
}

/** 칸반 보드용. 컬럼별로 상위 N건만 가져와 렌더 비용을 제한한다. */
export async function getTaskBoard(filters: TaskFilters, limitPerColumn = 40) {
  const scope = await getAccessScope();
  const where = buildTaskWhere(scope, { ...filters, status: undefined });

  const [rows, counts] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      take: limitPerColumn * 5,
      select: LIST_SELECT,
    }),
    prisma.task.groupBy({ by: ['status'], where, _count: { _all: true } }),
  ]);

  const items: TaskListItem[] = rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    status: row.status,
    priority: row.priority,
    category: row.category,
    progress: row.progress,
    dueDate: row.dueDate,
    createdAt: row.createdAt,
    commentCount: row._count.comments,
    attachmentCount: row._count.attachments,
    client: row.client,
    assignee: row.assignee,
    reporter: row.reporter,
  }));

  return {
    items: items.sort(
      (a, b) =>
        TASK_PRIORITY_WEIGHT[a.priority as TaskPriority] -
        TASK_PRIORITY_WEIGHT[b.priority as TaskPriority],
    ),
    counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
    scope,
  };
}

export async function getTaskDetail(id: string) {
  return prisma.task.findFirst({
    where: { id, deletedAt: null },
    include: {
      assignee: { select: { id: true, name: true, avatarColor: true, position: true } },
      reporter: { select: { id: true, name: true, avatarColor: true, position: true } },
      client: { select: { id: true, name: true, code: true } },
      deal: { select: { id: true, code: true, title: true, stage: true } },
      watchers: { select: { userId: true, user: { select: { name: true, avatarColor: true } } } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, avatarColor: true, position: true } } },
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
}

/** 업무 등록·수정 폼의 선택 목록 */
export async function getTaskFormOptions() {
  const [users, clients] = await Promise.all([
    prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true, position: true, department: { select: { name: true } } },
    }),
    prisma.client.findMany({
      where: { deletedAt: null, status: { in: ['ACTIVE', 'PROSPECT'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return {
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      label: [user.department?.name, user.position].filter(Boolean).join(' · '),
    })),
    clients,
  };
}
