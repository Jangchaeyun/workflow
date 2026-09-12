import 'server-only';

import { endOfDay, endOfMonth, endOfYear, startOfDay, startOfYear } from 'date-fns';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { dealScopeWhere, getAccessScope, type AccessScope } from '@/lib/scope';
import {
  DEAL_PIPELINE_STAGES,
  DEAL_STAGES,
  DEAL_STAGE_LABEL,
  DEAL_STAGE_PROBABILITY,
  PAGE_SIZE,
  type DealStage,
} from '@/lib/constants';

export interface DealFilters {
  q?: string;
  stage?: string;
  contract?: string;
  owner?: string;
  client?: string;
  /** month | quarter | overdue */
  close?: string;
  sort?: string;
  page?: string;
}

export interface DealCard {
  id: string;
  code: string;
  title: string;
  amount: number;
  stage: string;
  probability: number;
  contractStatus: string;
  expectedCloseDate: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  client: { id: string; name: string; grade: string };
  contactName: string | null;
  owner: { id: string; name: string; avatarColor: string };
  consultationCount: number;
  taskCount: number;
  /** 마지막 상담일. 오래 방치된 영업건을 찾아내는 데 쓴다. */
  lastContactAt: Date | null;
}

/**
 * 영업건 검색 조건 → Prisma where 절.
 * 항상 조회 범위(스코프)와 AND 로 묶어 담당하지 않은 영업건이 노출되지 않게 한다.
 */
export function buildDealWhere(scope: AccessScope, filters: DealFilters): Prisma.DealWhereInput {
  const conditions: Prisma.DealWhereInput[] = [{ deletedAt: null }, dealScopeWhere(scope)];

  if (filters.q?.trim()) {
    const keyword = filters.q.trim();
    conditions.push({
      OR: [
        { title: { contains: keyword } },
        { code: { contains: keyword } },
        { memo: { contains: keyword } },
        { client: { name: { contains: keyword } } },
      ],
    });
  }

  if (filters.stage) conditions.push({ stage: filters.stage });
  if (filters.contract) conditions.push({ contractStatus: filters.contract });
  if (filters.client) conditions.push({ clientId: filters.client });

  if (filters.owner === 'me') conditions.push({ ownerId: scope.userId });
  else if (filters.owner) conditions.push({ ownerId: filters.owner });

  const today = startOfDay(new Date());
  if (filters.close === 'month') {
    conditions.push({ expectedCloseDate: { gte: today, lte: endOfMonth(today) } });
  } else if (filters.close === 'quarter') {
    const quarterEnd = endOfMonth(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 2, 1));
    conditions.push({ expectedCloseDate: { gte: today, lte: quarterEnd } });
  } else if (filters.close === 'overdue') {
    // 마감 예정일이 지났는데 아직 종료되지 않은 건 = 관리가 필요한 영업건
    conditions.push({
      stage: { notIn: ['WON', 'LOST'] },
      expectedCloseDate: { lt: today },
    });
  }

  return { AND: conditions };
}

function buildDealOrderBy(sort?: string): Prisma.DealOrderByWithRelationInput[] {
  switch (sort) {
    case 'amount':
      return [{ amount: 'desc' }];
    case 'close':
      return [{ expectedCloseDate: 'asc' }, { createdAt: 'desc' }];
    case 'probability':
      return [{ probability: 'desc' }, { amount: 'desc' }];
    case 'oldest':
      return [{ createdAt: 'asc' }];
    default:
      return [{ createdAt: 'desc' }];
  }
}

const DEAL_CARD_SELECT = {
  id: true,
  code: true,
  title: true,
  amount: true,
  stage: true,
  probability: true,
  contractStatus: true,
  expectedCloseDate: true,
  closedAt: true,
  createdAt: true,
  client: { select: { id: true, name: true, grade: true } },
  contact: { select: { name: true } },
  owner: { select: { id: true, name: true, avatarColor: true } },
  _count: { select: { consultations: true, tasks: true } },
  consultations: {
    where: { deletedAt: null },
    orderBy: { consultedAt: 'desc' },
    take: 1,
    select: { consultedAt: true },
  },
} satisfies Prisma.DealSelect;

type DealCardRow = Prisma.DealGetPayload<{ select: typeof DEAL_CARD_SELECT }>;

function toDealCard(row: DealCardRow): DealCard {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    amount: row.amount,
    stage: row.stage,
    probability: row.probability,
    contractStatus: row.contractStatus,
    expectedCloseDate: row.expectedCloseDate,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    client: row.client,
    contactName: row.contact?.name ?? null,
    owner: row.owner,
    consultationCount: row._count.consultations,
    taskCount: row._count.tasks,
    lastContactAt: row.consultations[0]?.consultedAt ?? null,
  };
}

/** 단계별 건수·금액 요약. 파이프라인 헤더와 목록 탭에서 공유한다. */
export interface StageSummary {
  stage: DealStage;
  label: string;
  count: number;
  amount: number;
  weighted: number;
}

function buildStageSummary(
  groups: { stage: string; _count: { _all: number }; _sum: { amount: number | null } }[],
  stages: readonly DealStage[] = DEAL_STAGES,
): StageSummary[] {
  return stages.map((stage) => {
    const row = groups.find((group) => group.stage === stage);
    const amount = row?._sum.amount ?? 0;
    return {
      stage,
      label: DEAL_STAGE_LABEL[stage],
      count: row?._count._all ?? 0,
      amount,
      weighted: Math.round((amount * DEAL_STAGE_PROBABILITY[stage]) / 100),
    };
  });
}

export async function getDealList(filters: DealFilters) {
  const scope = await getAccessScope();
  const where = buildDealWhere(scope, filters);
  const page = Math.max(1, Number(filters.page ?? 1) || 1);

  const [total, rows, stageGroups] = await Promise.all([
    prisma.deal.count({ where }),
    prisma.deal.findMany({
      where,
      orderBy: buildDealOrderBy(filters.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: DEAL_CARD_SELECT,
    }),
    // 단계 탭 건수는 단계 필터를 뺀 조건으로 세야 각 탭의 전체 건수가 보인다.
    prisma.deal.groupBy({
      by: ['stage'],
      where: buildDealWhere(scope, { ...filters, stage: undefined }),
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  return {
    items: rows.map(toDealCard),
    total,
    page,
    pageSize: PAGE_SIZE,
    stageSummary: buildStageSummary(stageGroups),
    scope,
  };
}

/**
 * 파이프라인 보드용 조회.
 * 컬럼별 상한을 둬서 데이터가 늘어도 렌더 비용이 폭발하지 않게 한다.
 */
export async function getDealPipeline(filters: DealFilters, limitPerStage = 30) {
  const scope = await getAccessScope();
  // 보드는 단계별 컬럼이 곧 상태이므로 단계 필터는 무시한다.
  const where = buildDealWhere(scope, { ...filters, stage: undefined });

  const [rows, stageGroups] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: [{ amount: 'desc' }, { expectedCloseDate: 'asc' }],
      take: limitPerStage * DEAL_PIPELINE_STAGES.length,
      select: DEAL_CARD_SELECT,
    }),
    prisma.deal.groupBy({
      by: ['stage'],
      where,
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const items = rows.map(toDealCard);

  return {
    items,
    stageSummary: buildStageSummary(stageGroups),
    /** 담당자가 본인이거나 전체 권한이 있는 건만 드래그를 허용한다. */
    editableIds: scope.permissions.has('deal:update')
      ? items.filter((deal) => scope.canReadAllDeals || deal.owner.id === scope.userId).map((deal) => deal.id)
      : [],
    scope,
  };
}

export async function getDealDetail(id: string) {
  return prisma.deal.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: {
        select: { id: true, code: true, name: true, grade: true, status: true, industry: true, phone: true },
      },
      contact: { select: { id: true, name: true, position: true, phone: true, mobile: true, email: true } },
      owner: { select: { id: true, name: true, avatarColor: true, position: true } },
      consultations: {
        where: { deletedAt: null },
        orderBy: { consultedAt: 'desc' },
        take: 20,
        include: {
          user: { select: { name: true, avatarColor: true } },
          contact: { select: { name: true } },
        },
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assignee: { select: { name: true, avatarColor: true } },
        },
      },
    },
  });
}

/** 영업건 상세의 변경 이력 (감사 로그를 그대로 활용) */
export async function getDealHistory(dealId: string) {
  return prisma.activityLog.findMany({
    where: { entityType: 'Deal', entityId: dealId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      action: true,
      summary: true,
      createdAt: true,
      user: { select: { name: true, avatarColor: true } },
    },
  });
}

/** 영업건 등록·수정 폼 선택 목록. 담당자는 거래처별로 걸러 쓸 수 있게 clientId 를 함께 준다. */
export async function getDealFormOptions() {
  const [clients, contacts, owners] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: null, status: { notIn: ['CHURNED'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.contact.findMany({
      where: { deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, position: true, clientId: true },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SALES', 'MANAGER', 'ADMIN'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, position: true },
    }),
  ]);

  return {
    clients,
    contacts: contacts.map((contact) => ({
      id: contact.id,
      clientId: contact.clientId,
      name: contact.name,
      label: contact.position ?? '',
    })),
    owners: owners.map((owner) => ({
      id: owner.id,
      name: owner.name,
      label: owner.position ?? '',
    })),
  };
}

// ---------------------------------------------------------------------------
// 매출 통계
// ---------------------------------------------------------------------------

export interface SalesReport {
  year: number;
  availableYears: number[];
  summary: {
    wonAmount: number;
    wonCount: number;
    lostAmount: number;
    lostCount: number;
    openAmount: number;
    openCount: number;
    weightedForecast: number;
    targetAmount: number;
    winRate: number;
    averageDealSize: number;
    /** 리드 → 수주 평균 소요일 */
    averageCycleDays: number | null;
  };
  monthly: { label: string; revenue: number; target: number }[];
  stageFunnel: StageSummary[];
  contractMix: { status: string; count: number; amount: number }[];
  ownerRanking: {
    id: string;
    name: string;
    avatarColor: string;
    position: string | null;
    wonAmount: number;
    wonCount: number;
    openAmount: number;
    targetAmount: number;
    achievement: number;
  }[];
  topClients: {
    id: string;
    name: string;
    grade: string;
    wonAmount: number;
    wonCount: number;
  }[];
  lostReasons: { reason: string; count: number; amount: number }[];
}

/**
 * 연간 매출 통계.
 *
 * 목표 대비 실적, 파이프라인 예측, 담당자·거래처별 기여도를 한 번에 계산한다.
 * 집계 대상은 조회 범위(스코프) 안의 영업건으로 제한되므로
 * 영업담당이 열면 본인 실적만, 팀장·관리자가 열면 전사 실적이 나온다.
 */
export async function getSalesReport(yearParam?: string): Promise<SalesReport> {
  const scope = await getAccessScope();
  const baseWhere = buildDealWhere(scope, {});

  const now = new Date();
  const requested = Number(yearParam);
  const year = Number.isFinite(requested) && requested > 2000 ? requested : now.getFullYear();
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(yearStart);

  const closedThisYear: Prisma.DealWhereInput = {
    AND: [baseWhere, { closedAt: { gte: yearStart, lte: yearEnd } }],
  };
  const openWhere: Prisma.DealWhereInput = {
    AND: [baseWhere, { stage: { notIn: ['WON', 'LOST'] } }],
  };

  const [
    wonDeals,
    lostDeals,
    openGroups,
    targets,
    ownerRows,
    clientGroups,
    firstDeal,
    cycleSamples,
  ] = await Promise.all([
    prisma.deal.findMany({
      where: { AND: [closedThisYear, { stage: 'WON' }] },
      select: {
        amount: true,
        closedAt: true,
        contractStatus: true,
        ownerId: true,
        clientId: true,
      },
    }),
    prisma.deal.findMany({
      where: { AND: [closedThisYear, { stage: 'LOST' }] },
      select: { amount: true, lostReason: true },
    }),
    prisma.deal.groupBy({
      by: ['stage'],
      where: openWhere,
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.salesTarget.findMany({
      where: { year },
      select: { month: true, targetAmount: true, userId: true },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SALES', 'MANAGER', 'ADMIN'] } },
      select: { id: true, name: true, avatarColor: true, position: true },
    }),
    prisma.deal.groupBy({
      by: ['clientId'],
      where: { AND: [closedThisYear, { stage: 'WON' }] },
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 8,
    }),
    // 연도 선택 목록은 실제 데이터가 있는 구간만 노출한다.
    prisma.deal.findFirst({
      where: baseWhere,
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.deal.findMany({
      where: { AND: [closedThisYear, { stage: 'WON' }] },
      select: { createdAt: true, closedAt: true },
      take: 200,
    }),
  ]);

  const openSummary = buildStageSummary(openGroups, DEAL_PIPELINE_STAGES.filter((stage) => stage !== 'WON'));

  const wonAmount = wonDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const lostAmount = lostDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const openAmount = openSummary.reduce((sum, row) => sum + row.amount, 0);
  const openCount = openSummary.reduce((sum, row) => sum + row.count, 0);
  const weightedForecast = openSummary.reduce((sum, row) => sum + row.weighted, 0);
  const targetAmount = targets.reduce((sum, row) => sum + row.targetAmount, 0);

  const closedCount = wonDeals.length + lostDeals.length;

  const cycleDays = cycleSamples
    .filter((deal) => deal.closedAt)
    .map((deal) => (deal.closedAt!.getTime() - deal.createdAt.getTime()) / 86_400_000)
    .filter((days) => days >= 0);

  // 월별 실적: 목표는 담당자별 목표를 월 단위로 합산한다.
  const monthlyTargets = new Map<number, number>();
  for (const target of targets) {
    monthlyTargets.set(target.month, (monthlyTargets.get(target.month) ?? 0) + target.targetAmount);
  }

  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const revenue = wonDeals
      .filter((deal) => deal.closedAt && deal.closedAt.getMonth() + 1 === month)
      .reduce((sum, deal) => sum + deal.amount, 0);

    return { label: `${month}월`, revenue, target: monthlyTargets.get(month) ?? 0 };
  });

  // 담당자별 실적 + 목표 달성률
  const ownerTargets = new Map<string, number>();
  for (const target of targets) {
    if (!target.userId) continue;
    ownerTargets.set(target.userId, (ownerTargets.get(target.userId) ?? 0) + target.targetAmount);
  }

  const openByOwner = await prisma.deal.groupBy({
    by: ['ownerId'],
    where: openWhere,
    _sum: { amount: true },
  });

  const ownerRanking = ownerRows
    .map((owner) => {
      const ownWon = wonDeals.filter((deal) => deal.ownerId === owner.id);
      const ownWonAmount = ownWon.reduce((sum, deal) => sum + deal.amount, 0);
      const target = ownerTargets.get(owner.id) ?? 0;

      return {
        id: owner.id,
        name: owner.name,
        avatarColor: owner.avatarColor,
        position: owner.position,
        wonAmount: ownWonAmount,
        wonCount: ownWon.length,
        openAmount: openByOwner.find((row) => row.ownerId === owner.id)?._sum.amount ?? 0,
        targetAmount: target,
        achievement: target > 0 ? Math.round((ownWonAmount / target) * 100) : 0,
      };
    })
    // 실적도 목표도 파이프라인도 없는 사람은 표에서 뺀다.
    .filter((row) => row.wonAmount > 0 || row.targetAmount > 0 || row.openAmount > 0)
    .sort((a, b) => b.wonAmount - a.wonAmount);

  const clientNames = await prisma.client.findMany({
    where: { id: { in: clientGroups.map((group) => group.clientId) } },
    select: { id: true, name: true, grade: true },
  });

  const topClients = clientGroups.map((group) => {
    const client = clientNames.find((row) => row.id === group.clientId);
    return {
      id: group.clientId,
      name: client?.name ?? '(삭제된 거래처)',
      grade: client?.grade ?? 'C',
      wonAmount: group._sum.amount ?? 0,
      wonCount: group._count._all,
    };
  });

  // 계약 상태 분포는 수주 건에 대해서만 의미가 있다.
  const contractMix = Object.entries(
    wonDeals.reduce<Record<string, { count: number; amount: number }>>((acc, deal) => {
      const bucket = (acc[deal.contractStatus] ??= { count: 0, amount: 0 });
      bucket.count += 1;
      bucket.amount += deal.amount;
      return acc;
    }, {}),
  ).map(([status, value]) => ({ status, ...value }));

  const lostReasons = Object.entries(
    lostDeals.reduce<Record<string, { count: number; amount: number }>>((acc, deal) => {
      const key = deal.lostReason?.trim() || '사유 미기재';
      const bucket = (acc[key] ??= { count: 0, amount: 0 });
      bucket.count += 1;
      bucket.amount += deal.amount;
      return acc;
    }, {}),
  )
    .map(([reason, value]) => ({ reason, ...value }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const firstYear = firstDeal?.createdAt.getFullYear() ?? now.getFullYear();
  const availableYears = Array.from(
    { length: Math.max(1, now.getFullYear() - firstYear + 1) },
    (_, index) => now.getFullYear() - index,
  );

  return {
    year,
    availableYears,
    summary: {
      wonAmount,
      wonCount: wonDeals.length,
      lostAmount,
      lostCount: lostDeals.length,
      openAmount,
      openCount,
      weightedForecast,
      targetAmount,
      winRate: closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0,
      averageDealSize: wonDeals.length > 0 ? Math.round(wonAmount / wonDeals.length) : 0,
      averageCycleDays:
        cycleDays.length > 0
          ? Math.round(cycleDays.reduce((sum, days) => sum + days, 0) / cycleDays.length)
          : null,
    },
    monthly,
    stageFunnel: openSummary,
    contractMix,
    ownerRanking,
    topClients,
    lostReasons,
  };
}

/** 영업 목표 설정 화면용. 담당자 × 월 목표를 표 형태로 반환한다. */
export async function getSalesTargets(year: number) {
  const [owners, targets] = await Promise.all([
    prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SALES', 'MANAGER'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, avatarColor: true, position: true },
    }),
    prisma.salesTarget.findMany({
      where: { year, userId: { not: null } },
      select: { id: true, userId: true, month: true, targetAmount: true },
    }),
  ]);

  const achieved = await prisma.deal.groupBy({
    by: ['ownerId'],
    where: {
      deletedAt: null,
      stage: 'WON',
      closedAt: { gte: startOfYear(new Date(year, 0, 1)), lte: endOfYear(new Date(year, 0, 1)) },
    },
    _sum: { amount: true },
  });

  return owners.map((owner) => {
    const own = targets.filter((target) => target.userId === owner.id);
    const total = own.reduce((sum, target) => sum + target.targetAmount, 0);
    const wonAmount = achieved.find((row) => row.ownerId === owner.id)?._sum.amount ?? 0;

    return {
      ...owner,
      months: Object.fromEntries(own.map((target) => [target.month, target.targetAmount])) as Record<
        number,
        number
      >,
      totalTarget: total,
      wonAmount,
      achievement: total > 0 ? Math.round((wonAmount / total) * 100) : 0,
    };
  });
}

/** 오늘 기준으로 관리가 필요한 영업건 (마감 임박 · 방치) */
export async function getDealAlerts() {
  const scope = await getAccessScope();
  const today = startOfDay(new Date());
  const monthEnd = endOfDay(endOfMonth(today));

  const [closingSoon, stale] = await Promise.all([
    prisma.deal.findMany({
      where: {
        AND: [
          buildDealWhere(scope, {}),
          { stage: { notIn: ['WON', 'LOST'] } },
          { expectedCloseDate: { not: null, lte: monthEnd } },
        ],
      },
      orderBy: { expectedCloseDate: 'asc' },
      take: 6,
      select: DEAL_CARD_SELECT,
    }),
    prisma.deal.findMany({
      where: {
        AND: [
          buildDealWhere(scope, {}),
          { stage: { notIn: ['WON', 'LOST'] } },
          // 상담 기록이 아예 없는 영업건은 접점이 만들어지지 않은 상태다.
          { consultations: { none: { deletedAt: null } } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 6,
      select: DEAL_CARD_SELECT,
    }),
  ]);

  return {
    closingSoon: closingSoon.map(toDealCard),
    stale: stale.map(toDealCard),
  };
}