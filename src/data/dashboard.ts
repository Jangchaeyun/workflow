import 'server-only';

import {
  addDays,
  endOfDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';

import { prisma } from '@/lib/db';
import { getAccessScope, dealScopeWhere, taskScopeWhere } from '@/lib/scope';
import {
  DEAL_PIPELINE_STAGES,
  TASK_BOARD_COLUMNS,
  TASK_STATUS_LABEL,
  DEAL_STAGE_LABEL,
  type DealStage,
  type TaskStatus,
} from '@/lib/constants';

export interface DashboardData {
  kpi: {
    dueToday: number;
    inProgress: number;
    doneThisMonth: number;
    overdue: number;
    newClients: number | null;
    unassigned: number | null;
  };
  statusDistribution: { status: TaskStatus; label: string; count: number }[];
  weeklyTrend: { label: string; created: number; completed: number }[];
  recentTasks: RecentTask[];
  dueSoonTasks: RecentTask[];
  pipeline: { stage: DealStage; label: string; count: number; amount: number; weighted: number }[] | null;
  monthlyRevenue: { label: string; revenue: number; target: number }[] | null;
  followUps:
    | {
        id: string;
        clientId: string;
        clientName: string;
        nextAction: string;
        nextActionAt: Date;
        userName: string;
      }[]
    | null;
  workload:
    | { userId: string; name: string; avatarColor: string; open: number; overdue: number }[]
    | null;
}

export interface RecentTask {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  dueDate: Date | null;
  clientName: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
}

const RECENT_TASK_SELECT = {
  id: true,
  code: true,
  title: true,
  status: true,
  priority: true,
  progress: true,
  dueDate: true,
  client: { select: { name: true } },
  assignee: { select: { name: true, avatarColor: true } },
} as const;

type TaskRow = {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  dueDate: Date | null;
  client: { name: string } | null;
  assignee: { name: string; avatarColor: string } | null;
};

function toRecentTask(task: TaskRow): RecentTask {
  return {
    id: task.id,
    code: task.code,
    title: task.title,
    status: task.status,
    priority: task.priority,
    progress: task.progress,
    dueDate: task.dueDate,
    clientName: task.client?.name ?? null,
    assigneeName: task.assignee?.name ?? null,
    assigneeColor: task.assignee?.avatarColor ?? null,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const scope = await getAccessScope();
  const taskWhere = { ...taskScopeWhere(scope), deletedAt: null };
  const dealWhere = { ...dealScopeWhere(scope), deletedAt: null };

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const trendStart = startOfWeek(subWeeks(todayStart, 7), { weekStartsOn: 1 });

  const canReadClients = scope.permissions.has('client:read');
  const canReadDeals = scope.permissions.has('deal:read:own') || scope.canReadAllDeals;
  const canReadRevenue = scope.permissions.has('report:sales');
  const canReadConsultations = scope.permissions.has('consultation:read');

  const [
    dueToday,
    inProgress,
    doneThisMonth,
    overdue,
    statusGroups,
    trendTasks,
    recentTasks,
    dueSoonTasks,
  ] = await Promise.all([
    prisma.task.count({
      where: { ...taskWhere, status: { not: 'DONE' }, dueDate: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.task.count({ where: { ...taskWhere, status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { ...taskWhere, status: 'DONE', completedAt: { gte: monthStart } } }),
    prisma.task.count({
      where: { ...taskWhere, status: { not: 'DONE' }, dueDate: { lt: todayStart } },
    }),
    prisma.task.groupBy({ by: ['status'], where: taskWhere, _count: { _all: true } }),
    // 주간 추이는 생성/완료 두 축이 필요해 날짜만 뽑아 JS 에서 버킷팅한다.
    prisma.task.findMany({
      where: {
        ...taskWhere,
        OR: [{ createdAt: { gte: trendStart } }, { completedAt: { gte: trendStart } }],
      },
      select: { createdAt: true, completedAt: true },
    }),
    prisma.task.findMany({
      where: taskWhere,
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: RECENT_TASK_SELECT,
    }),
    prisma.task.findMany({
      where: {
        ...taskWhere,
        status: { not: 'DONE' },
        dueDate: { not: null, lte: endOfDay(addDays(now, 7)) },
      },
      orderBy: { dueDate: 'asc' },
      take: 6,
      select: RECENT_TASK_SELECT,
    }),
  ]);

  const statusCountMap = new Map(statusGroups.map((row) => [row.status, row._count._all]));

  const [newClients, unassigned, dealGroups, wonDeals, targets, followUps, workloadRows] =
    await Promise.all([
      canReadClients
        ? prisma.client.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } })
        : Promise.resolve(null),
      scope.canReadAllTasks
        ? prisma.task.count({ where: { ...taskWhere, assigneeId: null, status: { not: 'DONE' } } })
        : Promise.resolve(null),
      canReadDeals
        ? prisma.deal.groupBy({
            by: ['stage'],
            where: dealWhere,
            _count: { _all: true },
            _sum: { amount: true },
          })
        : Promise.resolve(null),
      canReadRevenue
        ? prisma.deal.findMany({
            where: {
              ...dealWhere,
              stage: 'WON',
              closedAt: { gte: startOfMonth(subMonths(now, 5)) },
            },
            select: { amount: true, closedAt: true },
          })
        : Promise.resolve(null),
      canReadRevenue
        ? prisma.salesTarget.findMany({
            where: { year: { gte: subMonths(now, 5).getFullYear() } },
            select: { year: true, month: true, targetAmount: true },
          })
        : Promise.resolve(null),
      canReadConsultations
        ? prisma.consultation.findMany({
            where: { deletedAt: null, nextActionAt: { gte: todayStart } },
            orderBy: { nextActionAt: 'asc' },
            take: 5,
            select: {
              id: true,
              nextAction: true,
              nextActionAt: true,
              client: { select: { id: true, name: true } },
              user: { select: { name: true } },
            },
          })
        : Promise.resolve(null),
      scope.canReadAllTasks
        ? prisma.user.findMany({
            where: { status: 'ACTIVE', deletedAt: null, role: { not: 'ADMIN' } },
            select: {
              id: true,
              name: true,
              avatarColor: true,
              assignedTasks: {
                where: { deletedAt: null, status: { not: 'DONE' } },
                select: { dueDate: true },
              },
            },
          })
        : Promise.resolve(null),
    ]);

  return {
    kpi: { dueToday, inProgress, doneThisMonth, overdue, newClients, unassigned },

    statusDistribution: TASK_BOARD_COLUMNS.map((status) => ({
      status,
      label: TASK_STATUS_LABEL[status],
      count: statusCountMap.get(status) ?? 0,
    })),

    weeklyTrend: buildWeeklyTrend(trendTasks, trendStart),

    recentTasks: recentTasks.map(toRecentTask),
    dueSoonTasks: dueSoonTasks.map(toRecentTask),

    pipeline: dealGroups
      ? DEAL_PIPELINE_STAGES.map((stage) => {
          const row = dealGroups.find((group) => group.stage === stage);
          const amount = row?._sum.amount ?? 0;
          const probability = stage === 'WON' ? 1 : PIPELINE_WEIGHT[stage];
          return {
            stage,
            label: DEAL_STAGE_LABEL[stage],
            count: row?._count._all ?? 0,
            amount,
            weighted: Math.round(amount * probability),
          };
        })
      : null,

    monthlyRevenue: wonDeals ? buildMonthlyRevenue(now, wonDeals, targets ?? []) : null,

    followUps:
      followUps?.map((row) => ({
        id: row.id,
        clientId: row.client.id,
        clientName: row.client.name,
        nextAction: row.nextAction ?? '후속 조치',
        nextActionAt: row.nextActionAt as Date,
        userName: row.user.name,
      })) ?? null,

    workload: workloadRows
      ? workloadRows
          .map((user) => ({
            userId: user.id,
            name: user.name,
            avatarColor: user.avatarColor,
            open: user.assignedTasks.length,
            overdue: user.assignedTasks.filter(
              (task) => task.dueDate && task.dueDate < todayStart,
            ).length,
          }))
          .sort((a, b) => b.open - a.open)
          .slice(0, 6)
      : null,
  };
}

/** 파이프라인 가중치 (대시보드 요약용 고정값) */
const PIPELINE_WEIGHT: Record<DealStage, number> = {
  LEAD: 0.1,
  QUALIFIED: 0.3,
  PROPOSAL: 0.5,
  NEGOTIATION: 0.75,
  WON: 1,
  LOST: 0,
};

function buildWeeklyTrend(
  tasks: { createdAt: Date; completedAt: Date | null }[],
  trendStart: Date,
): { label: string; created: number; completed: number }[] {
  const buckets = Array.from({ length: 8 }, (_, index) => {
    const start = addDays(trendStart, index * 7);
    return { start, end: addDays(start, 7), created: 0, completed: 0 };
  });

  const indexOf = (date: Date) =>
    Math.floor((date.getTime() - trendStart.getTime()) / (7 * 86_400_000));

  for (const task of tasks) {
    const createdIndex = indexOf(task.createdAt);
    if (createdIndex >= 0 && createdIndex < buckets.length) buckets[createdIndex].created += 1;

    if (task.completedAt) {
      const completedIndex = indexOf(task.completedAt);
      if (completedIndex >= 0 && completedIndex < buckets.length) {
        buckets[completedIndex].completed += 1;
      }
    }
  }

  return buckets.map((bucket) => ({
    label: `${bucket.start.getMonth() + 1}/${bucket.start.getDate()}`,
    created: bucket.created,
    completed: bucket.completed,
  }));
}

function buildMonthlyRevenue(
  now: Date,
  wonDeals: { amount: number; closedAt: Date | null }[],
  targets: { year: number; month: number; targetAmount: number }[],
): { label: string; revenue: number; target: number }[] {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = subMonths(startOfMonth(now), 5 - index);
    return { year: date.getFullYear(), month: date.getMonth() + 1, revenue: 0, target: 0 };
  });

  const keyOf = (year: number, month: number) => `${year}-${month}`;
  const bucketMap = new Map(months.map((bucket) => [keyOf(bucket.year, bucket.month), bucket]));

  for (const deal of wonDeals) {
    if (!deal.closedAt) continue;
    const bucket = bucketMap.get(keyOf(deal.closedAt.getFullYear(), deal.closedAt.getMonth() + 1));
    if (bucket) bucket.revenue += deal.amount;
  }

  for (const target of targets) {
    const bucket = bucketMap.get(keyOf(target.year, target.month));
    if (bucket) bucket.target += target.targetAmount;
  }

  return months.map((bucket) => ({
    label: `${bucket.month}월`,
    revenue: bucket.revenue,
    target: bucket.target,
  }));
}
