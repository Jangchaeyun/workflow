import 'server-only';

import { prisma } from '@/lib/db';
import { dealScopeWhere, getAccessScope, taskScopeWhere } from '@/lib/scope';
import type { PermissionKey } from '@/lib/permissions';
import type { SearchResult } from '@/lib/search-types';

export type { SearchResult, SearchResultKind } from '@/lib/search-types';

const NAV_SHORTCUTS: (Omit<SearchResult, 'id'> & { permissions: PermissionKey[] })[] = [
  {
    kind: 'nav',
    title: '대시보드',
    subtitle: '홈 · 현황 요약',
    href: '/dashboard',
    permissions: ['dashboard:view'],
  },
  {
    kind: 'nav',
    title: '오늘 할 일',
    subtitle: '마감 · 후속 · 영업 마감',
    href: '/today',
    permissions: ['dashboard:view'],
  },
  {
    kind: 'nav',
    title: '업무 목록',
    subtitle: '업무 검색 · 필터',
    href: '/tasks',
    permissions: ['task:read:own', 'task:read:all'],
  },
  {
    kind: 'nav',
    title: '칸반 보드',
    subtitle: '상태별 드래그',
    href: '/tasks/board',
    permissions: ['task:read:own', 'task:read:all'],
  },
  {
    kind: 'nav',
    title: '거래처',
    subtitle: '고객 · 상담',
    href: '/clients',
    permissions: ['client:read'],
  },
  {
    kind: 'nav',
    title: '영업 파이프라인',
    subtitle: '단계 · 계약',
    href: '/sales',
    permissions: ['deal:read:own', 'deal:read:all'],
  },
  {
    kind: 'nav',
    title: '매출 통계',
    subtitle: '목표 · 실적',
    href: '/sales/reports',
    permissions: ['report:sales'],
  },
  {
    kind: 'nav',
    title: '직원 관리',
    subtitle: '승인 · 역할',
    href: '/admin/users',
    permissions: ['user:read'],
  },
  {
    kind: 'nav',
    title: '부서 관리',
    subtitle: '조직 구조',
    href: '/admin/departments',
    permissions: ['department:manage'],
  },
  {
    kind: 'nav',
    title: '권한 관리',
    subtitle: '역할 매트릭스',
    href: '/admin/permissions',
    permissions: ['permission:manage'],
  },
  {
    kind: 'nav',
    title: '활동 로그',
    subtitle: '감사 기록',
    href: '/admin/logs',
    permissions: ['log:read'],
  },
];

/**
 * 키워드로 업무·거래처·영업건을 한 번에 검색한다.
 * 권한 스코프를 그대로 적용해 메뉴에 없는 데이터가 나오지 않게 한다.
 */
export async function globalSearch(query: string, limit = 8): Promise<SearchResult[]> {
  const q = query.trim();
  const scope = await getAccessScope();

  const allowedNav = NAV_SHORTCUTS.filter((item) =>
    item.permissions.some((permission) => scope.permissions.has(permission)),
  ).map((item, index) => ({
    id: `nav-${index}`,
    kind: item.kind,
    title: item.title,
    subtitle: item.subtitle,
    href: item.href,
  }));

  if (!q) {
    return allowedNav.slice(0, 6);
  }

  const needle = q.toLowerCase();
  const navHits = allowedNav.filter(
    (item) =>
      item.title.toLowerCase().includes(needle) || item.subtitle.toLowerCase().includes(needle),
  );

  const canClients = scope.permissions.has('client:read');
  const canDeals =
    scope.permissions.has('deal:read:own') || scope.permissions.has('deal:read:all');
  const canTasks =
    scope.permissions.has('task:read:own') || scope.permissions.has('task:read:all');

  const [tasks, clients, deals] = await Promise.all([
    canTasks
      ? prisma.task.findMany({
          where: {
            deletedAt: null,
            AND: [
              taskScopeWhere(scope),
              {
                OR: [
                  { title: { contains: q } },
                  { code: { contains: q } },
                  { description: { contains: q } },
                ],
              },
            ],
          },
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            client: { select: { name: true } },
          },
          take: limit,
          orderBy: { updatedAt: 'desc' },
        })
      : Promise.resolve([]),
    canClients
      ? prisma.client.findMany({
          where: {
            deletedAt: null,
            OR: [
              { name: { contains: q } },
              { code: { contains: q } },
              { businessNo: { contains: q } },
            ],
          },
          select: { id: true, code: true, name: true, industry: true },
          take: limit,
          orderBy: { updatedAt: 'desc' },
        })
      : Promise.resolve([]),
    canDeals
      ? prisma.deal.findMany({
          where: {
            deletedAt: null,
            AND: [
              dealScopeWhere(scope),
              {
                OR: [{ title: { contains: q } }, { code: { contains: q } }],
              },
            ],
          },
          select: {
            id: true,
            code: true,
            title: true,
            stage: true,
            client: { select: { name: true } },
          },
          take: limit,
          orderBy: { updatedAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  const results: SearchResult[] = [
    ...navHits,
    ...tasks.map((task) => ({
      id: task.id,
      kind: 'task' as const,
      title: task.title,
      subtitle: `${task.code}${task.client ? ` · ${task.client.name}` : ''}`,
      href: `/tasks/${task.id}`,
    })),
    ...clients.map((client) => ({
      id: client.id,
      kind: 'client' as const,
      title: client.name,
      subtitle: `${client.code}${client.industry ? ` · ${client.industry}` : ''}`,
      href: `/clients/${client.id}`,
    })),
    ...deals.map((deal) => ({
      id: deal.id,
      kind: 'deal' as const,
      title: deal.title,
      subtitle: `${deal.code} · ${deal.client.name}`,
      href: `/sales/${deal.id}`,
    })),
  ];

  return results.slice(0, 12);
}
