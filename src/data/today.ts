import 'server-only';

import { addDays, endOfDay, startOfDay } from 'date-fns';

import { prisma } from '@/lib/db';
import { dealScopeWhere, getAccessScope, taskScopeWhere } from '@/lib/scope';

export interface TodayItem {
  id: string;
  kind: 'task' | 'consultation' | 'deal';
  title: string;
  subtitle: string;
  href: string;
  when: Date;
  /** overdue | today | upcoming */
  bucket: 'overdue' | 'today' | 'upcoming';
  meta?: string;
}

/**
 * 오늘 기준으로 처리해야 할 업무·상담 후속·영업 마감을 한곳에 모은다.
 * 권한 스코프를 그대로 적용한다.
 */
export async function getTodayAgenda(): Promise<{
  overdue: TodayItem[];
  today: TodayItem[];
  upcoming: TodayItem[];
  counts: { overdue: number; today: number; upcoming: number; total: number };
}> {
  const scope = await getAccessScope();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));

  const canConsult =
    scope.permissions.has('consultation:read') && scope.permissions.has('client:read');
  const canDeals =
    scope.permissions.has('deal:read:own') || scope.permissions.has('deal:read:all');
  const canTasks =
    scope.permissions.has('task:read:own') || scope.permissions.has('task:read:all');

  const [tasks, consultations, deals] = await Promise.all([
    canTasks
      ? prisma.task.findMany({
          where: {
            deletedAt: null,
            status: { notIn: ['DONE'] },
            dueDate: { not: null, lte: weekEnd },
            AND: [taskScopeWhere(scope)],
          },
          select: {
            id: true,
            code: true,
            title: true,
            dueDate: true,
            priority: true,
            status: true,
            client: { select: { name: true } },
            assignee: { select: { name: true } },
          },
          orderBy: { dueDate: 'asc' },
          take: 40,
        })
      : Promise.resolve([]),
    canConsult
      ? prisma.consultation.findMany({
          where: {
            deletedAt: null,
            nextActionAt: { not: null, lte: weekEnd },
            nextAction: { not: null },
            ...(scope.canReadAllDeals
              ? {}
              : {
                  OR: [{ userId: scope.userId }, { client: { ownerId: scope.userId } }],
                }),
          },
          select: {
            id: true,
            nextAction: true,
            nextActionAt: true,
            clientId: true,
            client: { select: { name: true } },
            user: { select: { name: true } },
          },
          orderBy: { nextActionAt: 'asc' },
          take: 30,
        })
      : Promise.resolve([]),
    canDeals
      ? prisma.deal.findMany({
          where: {
            deletedAt: null,
            stage: { notIn: ['WON', 'LOST'] },
            expectedCloseDate: { not: null, lte: weekEnd },
            AND: [dealScopeWhere(scope)],
          },
          select: {
            id: true,
            code: true,
            title: true,
            expectedCloseDate: true,
            stage: true,
            amount: true,
            client: { select: { name: true } },
          },
          orderBy: { expectedCloseDate: 'asc' },
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  const items: TodayItem[] = [];

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const bucket = bucketFor(task.dueDate, todayStart, todayEnd);
    items.push({
      id: `task-${task.id}`,
      kind: 'task',
      title: task.title,
      subtitle: `${task.code}${task.client ? ` · ${task.client.name}` : ''}${
        task.assignee ? ` · ${task.assignee.name}` : ''
      }`,
      href: `/tasks/${task.id}`,
      when: task.dueDate,
      bucket,
      meta: task.priority,
    });
  }

  for (const row of consultations) {
    if (!row.nextActionAt || !row.nextAction) continue;
    const bucket = bucketFor(row.nextActionAt, todayStart, todayEnd);
    items.push({
      id: `consult-${row.id}`,
      kind: 'consultation',
      title: row.nextAction,
      subtitle: `${row.client.name} · 담당 ${row.user.name}`,
      href: `/clients/${row.clientId}`,
      when: row.nextActionAt,
      bucket,
    });
  }

  for (const deal of deals) {
    if (!deal.expectedCloseDate) continue;
    const bucket = bucketFor(deal.expectedCloseDate, todayStart, todayEnd);
    items.push({
      id: `deal-${deal.id}`,
      kind: 'deal',
      title: deal.title,
      subtitle: `${deal.code} · ${deal.client.name}`,
      href: `/sales/${deal.id}`,
      when: deal.expectedCloseDate,
      bucket,
      meta: String(Math.round(deal.amount)),
    });
  }

  const sortByWhen = (a: TodayItem, b: TodayItem) => a.when.getTime() - b.when.getTime();
  const overdue = items.filter((item) => item.bucket === 'overdue').sort(sortByWhen);
  const today = items.filter((item) => item.bucket === 'today').sort(sortByWhen);
  const upcoming = items.filter((item) => item.bucket === 'upcoming').sort(sortByWhen);

  return {
    overdue,
    today,
    upcoming,
    counts: {
      overdue: overdue.length,
      today: today.length,
      upcoming: upcoming.length,
      total: items.length,
    },
  };
}

function bucketFor(date: Date, todayStart: Date, todayEnd: Date): TodayItem['bucket'] {
  if (date < todayStart) return 'overdue';
  if (date <= todayEnd) return 'today';
  return 'upcoming';
}
