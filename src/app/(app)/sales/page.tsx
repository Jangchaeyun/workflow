import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, Handshake, KanbanSquare, List, TrendingUp } from 'lucide-react';

import { getMyPermissions, requireAnyPermission } from '@/lib/auth';
import { getDealList, getDealPipeline, getDealFormOptions, type DealFilters } from '@/data/deals';
import { CONTRACT_STATUS_LABEL, type ContractStatus } from '@/lib/constants';
import { buildQueryString, cn, daysUntil, formatCurrencyShort, formatDate } from '@/lib/utils';

import { PageHeader } from '@/components/layout/PageHeader';
import { LinkButton } from '@/components/ui/Button';
import { ExportCsvButton } from '@/components/ui/ExportCsvButton';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Avatar } from '@/components/ui/Avatar';
import { Progress } from '@/components/ui/Progress';
import { ContractStatusBadge, DealStageBadge } from '@/components/ui/StatusBadge';
import { DealFilterBar } from '@/components/sales/DealFilterBar';
import { DealCreateButton } from '@/components/sales/DealFormModal';
import { PipelineBoard, type PipelineDeal } from '@/components/sales/PipelineBoard';
import { DEAL_STAGE_COLORS } from '@/components/charts/chartTheme';

export const metadata: Metadata = { title: '영업 파이프라인' };

export default async function SalesPage({ searchParams }: PageProps<'/sales'>) {
  await requireAnyPermission('deal:read:own', 'deal:read:all');

  const raw = await searchParams;
  const view = pick(raw.view) === 'list' ? 'list' : 'board';

  const filters: DealFilters = {
    q: pick(raw.q),
    stage: pick(raw.stage),
    contract: pick(raw.contract),
    owner: pick(raw.owner),
    client: pick(raw.client),
    close: pick(raw.close),
    sort: pick(raw.sort),
    page: pick(raw.page),
  };

  const [permissions, options] = await Promise.all([getMyPermissions(), getDealFormOptions()]);

  const canCreate = permissions.has('deal:create');
  const canSeeAll = permissions.has('deal:read:all');
  const canSeeReports = permissions.has('report:sales');

  // 보드는 단계가 곧 컬럼이므로 단계 필터를 쓰지 않는다.
  const result =
    view === 'board'
      ? await getDealPipeline({ ...filters, stage: undefined, page: undefined })
      : await getDealList(filters);

  const query = Object.fromEntries(
    Object.entries({ ...filters, view: view === 'list' ? 'list' : undefined }).filter(([, value]) =>
      Boolean(value),
    ),
  ) as Record<string, string>;

  const openStages = result.stageSummary.filter(
    (row) => row.stage !== 'WON' && row.stage !== 'LOST',
  );
  const openAmount = openStages.reduce((sum, row) => sum + row.amount, 0);
  const openCount = openStages.reduce((sum, row) => sum + row.count, 0);
  const weighted = openStages.reduce((sum, row) => sum + row.weighted, 0);
  const wonRow = result.stageSummary.find((row) => row.stage === 'WON');
  const lostRow = result.stageSummary.find((row) => row.stage === 'LOST');
  const closedCount = (wonRow?.count ?? 0) + (lostRow?.count ?? 0);

  return (
    <>
      <PageHeader
        title="영업 파이프라인"
        description={
          canSeeAll
            ? '조직 전체 영업건의 단계별 진행 상황과 예측 매출을 관리합니다.'
            : '내가 담당하는 영업건의 단계와 계약 진행 상황을 관리합니다.'
        }
        action={
          <>
            <ExportCsvButton type="deals" query={{ stage: pick(raw.stage) }} />
            {canSeeReports && (
              <LinkButton href="/sales/reports" variant="secondary">
                <BarChart3 className="size-4" />
                매출 통계
              </LinkButton>
            )}
            {canCreate && (
              <DealCreateButton options={options} canAssignOwner={canSeeAll} />
            )}
          </>
        }
      />

      {/* 파이프라인 요약: 진행 중 금액과 확률 가중 예측을 함께 보여준다. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={<Handshake className="size-4" />}
          label="진행 중 영업건"
          value={`${openCount}건`}
          sub={formatCurrencyShort(openAmount)}
        />
        <SummaryTile
          icon={<TrendingUp className="size-4" />}
          label="가중 예측 매출"
          value={formatCurrencyShort(weighted)}
          sub="단계별 수주 확률 반영"
          tone="brand"
        />
        <SummaryTile
          label="수주 완료"
          value={`${wonRow?.count ?? 0}건`}
          sub={formatCurrencyShort(wonRow?.amount ?? 0)}
          tone="positive"
        />
        <SummaryTile
          label="수주 성공률"
          value={closedCount > 0 ? `${Math.round(((wonRow?.count ?? 0) / closedCount) * 100)}%` : '-'}
          sub={`종료 ${closedCount}건 기준`}
        />
      </div>

      {/* 단계별 금액 비중 바. 어느 단계에 물량이 몰려 있는지 한 줄로 파악한다. */}
      {openAmount > 0 && (
        <div className="card mb-4 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xs font-bold text-ink">단계별 금액 비중</h2>
            <span className="text-xs text-ink-faint">진행 중 {formatCurrencyShort(openAmount)}</span>
          </div>

          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-line">
            {openStages
              .filter((row) => row.amount > 0)
              .map((row) => (
                <div
                  key={row.stage}
                  style={{
                    width: `${(row.amount / openAmount) * 100}%`,
                    backgroundColor: DEAL_STAGE_COLORS[row.stage],
                  }}
                  title={`${row.label} ${formatCurrencyShort(row.amount)}`}
                />
              ))}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {openStages.map((row) => (
              <li key={row.stage} className="flex items-center gap-1.5 text-[11px]">
                <span
                  className="size-2 rounded-sm"
                  style={{ backgroundColor: DEAL_STAGE_COLORS[row.stage] }}
                  aria-hidden
                />
                <span className="text-ink-soft">{row.label}</span>
                <span className="font-medium text-ink">{row.count}건</span>
                <span className="text-ink-faint">{formatCurrencyShort(row.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 보기 전환 + 목록 전용 단계 탭 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          <ViewTab href={`/sales${buildQueryString(query, { view: undefined, page: undefined })}`} active={view === 'board'}>
            <KanbanSquare className="size-3.5" />
            파이프라인
          </ViewTab>
          <ViewTab href={`/sales${buildQueryString(query, { view: 'list', page: undefined })}`} active={view === 'list'}>
            <List className="size-3.5" />
            목록
          </ViewTab>
        </div>

        {view === 'list' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <StageTab
              href={`/sales${buildQueryString(query, { stage: undefined, page: undefined })}`}
              active={!filters.stage}
              label="전체"
              count={result.stageSummary.reduce((sum, row) => sum + row.count, 0)}
            />
            {result.stageSummary.map((row) => (
              <StageTab
                key={row.stage}
                href={`/sales${buildQueryString(query, { stage: row.stage, page: undefined })}`}
                active={filters.stage === row.stage}
                label={row.label}
                count={row.count}
              />
            ))}
          </div>
        )}
      </div>

      <DealFilterBar
        owners={options.owners.map((owner) => ({ id: owner.id, name: owner.name }))}
        clients={options.clients.map((client) => ({ id: client.id, name: client.name }))}
        showOwnerFilter={canSeeAll}
        showSort={view === 'list'}
      />

      {result.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Handshake className="size-5" />}
            title="조건에 맞는 영업건이 없습니다."
            description={
              canCreate
                ? '영업건을 등록하면 단계별 파이프라인과 예측 매출이 자동으로 집계됩니다.'
                : '검색어나 필터를 조정해보세요.'
            }
          />
        </Card>
      ) : view === 'board' ? (
        <PipelineBoard
          deals={result.items.map(toPipelineDeal)}
          editableIds={'editableIds' in result ? result.editableIds : []}
        />
      ) : (
        <Card>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-faint">
                  <th className="px-5 py-3 font-medium">영업건</th>
                  <th className="px-3 py-3 font-medium">단계</th>
                  <th className="px-3 py-3 font-medium">예상 금액</th>
                  <th className="w-36 px-3 py-3 font-medium">수주 확률</th>
                  <th className="px-3 py-3 font-medium">계약</th>
                  <th className="px-3 py-3 font-medium">담당</th>
                  <th className="px-5 py-3 font-medium">마감 예정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((deal) => {
                  const remaining = daysUntil(deal.expectedCloseDate);
                  const isOpen = deal.stage !== 'WON' && deal.stage !== 'LOST';
                  const late = isOpen && remaining !== null && remaining < 0;

                  return (
                    <tr key={deal.id} className="transition-colors hover:bg-surface-muted">
                      <td className="max-w-md px-5 py-3">
                        <Link href={`/sales/${deal.id}`} className="group block">
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-ink-faint">{deal.code}</span>
                            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
                              {deal.client.grade}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate font-medium text-ink group-hover:text-brand">
                            {deal.title}
                          </span>
                          <span className="block truncate text-xs text-ink-faint">
                            {deal.client.name}
                            {deal.contactName && ` · ${deal.contactName}`}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <DealStageBadge value={deal.stage} />
                      </td>
                      <td className="px-3 py-3 font-medium whitespace-nowrap text-ink">
                        {formatCurrencyShort(deal.amount)}
                      </td>
                      <td className="px-3 py-3">
                        {isOpen ? (
                          <Progress value={deal.probability} label="수주 확률" />
                        ) : (
                          <span className="text-xs text-ink-faint">종료</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <ContractStatusBadge value={deal.contractStatus} />
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2">
                          <Avatar name={deal.owner.name} color={deal.owner.avatarColor} size="xs" />
                          <span className="text-xs text-ink">{deal.owner.name}</span>
                        </span>
                      </td>
                      <td
                        className={cn(
                          'px-5 py-3 text-xs whitespace-nowrap',
                          late ? 'font-medium text-danger' : 'text-ink-soft',
                        )}
                      >
                        {formatDate(deal.expectedCloseDate)}
                        {late && (
                          <span className="block text-[11px]">{Math.abs(remaining!)}일 초과</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line lg:hidden">
            {result.items.map((deal) => (
              <li key={deal.id}>
                <Link href={`/sales/${deal.id}`} className="block px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <DealStageBadge value={deal.stage} />
                    <span className="ml-auto font-mono text-[11px] text-ink-faint">{deal.code}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-ink">{deal.title}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {[
                      deal.client.name,
                      formatCurrencyShort(deal.amount),
                      CONTRACT_STATUS_LABEL[deal.contractStatus as ContractStatus],
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    담당 {deal.owner.name} · 마감 {formatDate(deal.expectedCloseDate)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {'total' in result && (
            <Pagination
              page={result.page}
              total={result.total}
              pageSize={result.pageSize}
              basePath="/sales"
              query={query}
            />
          )}
        </Card>
      )}
    </>
  );
}

function toPipelineDeal(deal: Awaited<ReturnType<typeof getDealPipeline>>['items'][number]): PipelineDeal {
  return {
    id: deal.id,
    code: deal.code,
    title: deal.title,
    amount: deal.amount,
    stage: deal.stage,
    probability: deal.probability,
    contractStatus: deal.contractStatus,
    // 클라이언트 컴포넌트로 넘길 때는 문자열로 직렬화해 타임존 해석 차이를 없앤다.
    expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
    clientName: deal.client.name,
    clientGrade: deal.client.grade,
    ownerName: deal.owner.name,
    ownerColor: deal.owner.avatarColor,
    consultationCount: deal.consultationCount,
    lastContactAt: deal.lastContactAt?.toISOString() ?? null,
  };
}

function SummaryTile({
  icon,
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'brand' | 'positive';
}) {
  return (
    <div className="card px-5 py-4">
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-lg',
              tone === 'brand'
                ? 'bg-brand-soft text-brand'
                : tone === 'positive'
                  ? 'bg-positive-soft text-positive'
                  : 'bg-surface-muted text-ink-soft',
            )}
          >
            {icon}
          </span>
        )}
        <p className="text-xs text-ink-faint">{label}</p>
      </div>
      <p
        className={cn(
          'mt-2 text-xl font-bold tracking-tight',
          tone === 'brand' ? 'text-brand' : tone === 'positive' ? 'text-positive' : 'text-ink',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-faint">{sub}</p>}
    </div>
  );
}

function ViewTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-brand text-white' : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
      )}
    >
      {children}
    </Link>
  );
}

function StageTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-brand bg-brand text-white'
          : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
      )}
    >
      {label}
      <span className={cn('text-[11px]', active ? 'text-white/75' : 'text-ink-faint')}>{count}</span>
    </Link>
  );
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}
