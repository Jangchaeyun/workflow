import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { PAGE_SIZE } from '@/lib/constants';

export interface ClientFilters {
  q?: string;
  status?: string;
  grade?: string;
  scale?: string;
  owner?: string;
  sort?: string;
  page?: string;
}

function buildClientWhere(filters: ClientFilters): Prisma.ClientWhereInput {
  const conditions: Prisma.ClientWhereInput[] = [{ deletedAt: null }];

  if (filters.q?.trim()) {
    const keyword = filters.q.trim();
    conditions.push({
      OR: [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
        { industry: { contains: keyword } },
        { ceoName: { contains: keyword } },
        { businessNo: { contains: keyword } },
        // 담당자 이름으로도 찾을 수 있게 한다 (실무에서 자주 쓰는 검색 경로).
        { contacts: { some: { name: { contains: keyword }, deletedAt: null } } },
      ],
    });
  }

  if (filters.status) conditions.push({ status: filters.status });
  if (filters.grade) conditions.push({ grade: filters.grade });
  if (filters.scale) conditions.push({ scale: filters.scale });
  if (filters.owner) conditions.push({ ownerId: filters.owner });

  return { AND: conditions };
}

function buildClientOrderBy(sort?: string): Prisma.ClientOrderByWithRelationInput[] {
  switch (sort) {
    case 'name':
      return [{ name: 'asc' }];
    case 'grade':
      return [{ grade: 'asc' }, { name: 'asc' }];
    case 'oldest':
      return [{ createdAt: 'asc' }];
    default:
      return [{ createdAt: 'desc' }];
  }
}

export async function getClientList(filters: ClientFilters) {
  const where = buildClientWhere(filters);
  const page = Math.max(1, Number(filters.page ?? 1) || 1);

  const [total, rows, statusCounts] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy: buildClientOrderBy(filters.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        code: true,
        name: true,
        industry: true,
        scale: true,
        grade: true,
        status: true,
        phone: true,
        address: true,
        createdAt: true,
        owner: { select: { id: true, name: true, avatarColor: true } },
        _count: { select: { contacts: true, deals: true, consultations: true } },
        // 카드에 "최근 상담" 을 보여주기 위해 가장 최신 1건만 함께 가져온다.
        consultations: {
          where: { deletedAt: null },
          orderBy: { consultedAt: 'desc' },
          take: 1,
          select: { consultedAt: true, title: true },
        },
        deals: {
          where: { deletedAt: null, stage: 'WON' },
          select: { amount: true },
        },
      },
    }),
    prisma.client.groupBy({
      by: ['status'],
      where: buildClientWhere({ ...filters, status: undefined }),
      _count: { _all: true },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      industry: row.industry,
      scale: row.scale,
      grade: row.grade,
      status: row.status,
      phone: row.phone,
      address: row.address,
      createdAt: row.createdAt,
      owner: row.owner,
      contactCount: row._count.contacts,
      dealCount: row._count.deals,
      consultationCount: row._count.consultations,
      lastConsultation: row.consultations[0] ?? null,
      wonAmount: row.deals.reduce((sum, deal) => sum + deal.amount, 0),
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    statusCounts: Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])),
  };
}

export async function getClientDetail(id: string) {
  return prisma.client.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, avatarColor: true, position: true } },
      contacts: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      },
      deals: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { name: true, avatarColor: true } },
          contact: { select: { name: true } },
        },
      },
      consultations: {
        where: { deletedAt: null },
        orderBy: { consultedAt: 'desc' },
        take: 30,
        include: {
          user: { select: { name: true, avatarColor: true } },
          contact: { select: { name: true, position: true } },
          deal: { select: { id: true, code: true, title: true } },
        },
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 8,
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

/** 거래처 등록·수정 폼과 필터에서 쓰는 담당 영업 목록 */
export async function getClientOwnerOptions() {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null, role: { in: ['SALES', 'MANAGER', 'ADMIN'] } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, position: true },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    label: user.position ?? '',
  }));
}
