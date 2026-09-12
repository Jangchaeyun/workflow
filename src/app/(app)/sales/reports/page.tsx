import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Award,
  CircleSlash,
  Clock,
  Percent,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { getMyPermissions, requirePermission } from '@/lib/auth';
import { getSalesReport, getSalesTargets } from '@/data/deals';
import { CONTRACT_STATUS_LABEL, type ContractStatus } from '@/lib/constants';
import { cn, formatCurrency, formatCurrencyShort, percent } from '@/lib/utils';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Progress } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';
import { ContractStatusBadge } from '@/components/ui/StatusBadge';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { StageFunnelChart } from '@/components/charts/StageFunnelChart';
import { SalesTargetPanel } from '@/components/sales/SalesTargetPanel';

export const metadata: Metadata = { title: '매출 통계' };

export default async function SalesReportsPage({ searchParams }: PageProps<'/sales/reports'>) {
  await requirePermission('report:sales');

  const raw = await searchParams;
  const yearParam = Array.isArray(raw.year) ? raw.year[0] : raw.year;

  const [report, permissions] = await Promise.all([getSalesReport(yearParam), getMyPermissions()]);
  const targets = await getSalesTargets(report.year);

  const { summary } = report;
  const achievement = summary.targetAmount > 0 ? percent(summary.wonAmount, summary.targetAmount) : 0;
  const forecastTotal = summary.wonAmount + summary.weightedForecast;
  const canSeeAll = permissions.has('deal:read:all');

  return (
    <>
      <PageHeader
        title="매출 통계"
        description={
          canSeeAll
            ? '연간 목표 대비 실적, 파이프라인 예측, 담당자별 기여도를 분석합니다.'
            : '내가 담당한 영업건 기준의 실적과 파이프라인 예측입니다.'
        }
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            {report.availableYears.map((year) => (
              <Link
                key={year}
                href={`/sales/reports${year === new Date().getFullYear() ? '' : `?year=${year}`}`}
                aria-current={year === report.year ? 'page' : undefined}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  year === report.year
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
                )}
              >
                {year}년
              </Link>
            ))}
          </div>
        }
      />

      {/* 핵심 지표 */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Wallet className="size-4" />}
          tone="brand"
          label={`${report.year}년 수주 실적`}
          value={formatCurrencyShort(summary.wonAmount)}
          sub={`${summary.wonCount}건 · 건당 평균 ${formatCurrencyShort(summary.averageDealSize)}`}
        />
        <MetricCard
          icon={<Target className="size-4" />}
          label="목표 달성률"
          value={summary.targetAmount > 0 ? `${achievement}%` : '목표 미설정'}
          sub={
            summary.targetAmount > 0
              ? `목표 ${formatCurrencyShort(summary.targetAmount)}`
              : '아래 표에서 월별 목표를 설정하세요.'
          }
          progress={summary.targetAmount > 0 ? achievement : undefined}
        />
        <MetricCard
          icon={<TrendingUp className="size-4" />}
          label="파이프라인 예측"
          value={formatCurrencyShort(summary.weightedForecast)}
          sub={`진행 ${summary.openCount}건 · 총액 ${formatCurrencyShort(summary.openAmount)}`}
        />
        <MetricCard
          icon={<Percent className="size-4" />}
          label="수주 성공률"
          value={`${summary.winRate}%`}
          sub={`수주 ${summary.wonCount}건 / 실패 ${summary.lostCount}건`}
        />
      </div>

      {/* 보조 지표 */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-info-soft text-info">
            <TrendingUp className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-ink-faint">실적 + 가중 예측</p>
            <p className="text-base font-bold text-ink">{formatCurrencyShort(forecastTotal)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-danger-soft text-danger">
            <TrendingDown className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-ink-faint">실패 금액</p>
            <p className="text-base font-bold text-ink">{formatCurrencyShort(summary.lostAmount)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-caution-soft text-caution">
            <Clock className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-ink-faint">평균 영업 사이클</p>
            <p className="text-base font-bold text-ink">
              {summary.averageCycleDays !== null ? `${summary.averageCycleDays}일` : '-'}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="월별 수주 실적 대비 목표"
            description={`${report.year}년 · 수주 확정(WON) 처리일 기준`}
          />
          <CardBody>
            <RevenueChart data={report.monthly} height={280} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="파이프라인 단계별 금액" description="아직 종료되지 않은 영업건" />
          <CardBody>
            <StageFunnelChart data={report.stageFunnel} height={280} />
            <dl className="mt-3 space-y-1.5 border-t border-line pt-3">
              {report.stageFunnel.map((row) => (
                <div key={row.stage} className="flex items-center gap-2 text-xs">
                  <dt className="flex-1 text-ink-soft">{row.label}</dt>
                  <dd className="font-medium text-ink">{row.count}건</dd>
                  <dd className="w-20 text-right text-ink-faint">
                    가중 {formatCurrencyShort(row.weighted)}
                  </dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* 담당자별 실적 */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="담당자별 실적"
            description="수주 금액 순 · 목표가 설정된 담당자는 달성률이 함께 표시됩니다."
          />
          {report.ownerRanking.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={<Award className="size-5" />}
                title="집계할 실적이 없습니다."
                description="영업건을 등록하고 단계를 수주로 옮기면 실적이 집계됩니다."
              />
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-faint">
                    <th className="px-5 py-3 font-medium">담당자</th>
                    <th className="px-3 py-3 text-right font-medium">수주 실적</th>
                    <th className="px-3 py-3 text-right font-medium">진행 중</th>
                    <th className="px-3 py-3 text-right font-medium">목표</th>
                    <th className="w-44 px-5 py-3 font-medium">달성률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.ownerRanking.map((owner, index) => (
                    <tr key={owner.id} className="transition-colors hover:bg-surface-muted">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2">
                          {/* 상위 3명만 순위 배지를 달아 시선을 모은다. */}
                          <span
                            className={cn(
                              'flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold',
                              index === 0
                                ? 'bg-brand text-white'
                                : index < 3
                                  ? 'bg-brand-soft text-brand-dark'
                                  : 'bg-surface-muted text-ink-faint',
                            )}
                          >
                            {index + 1}
                          </span>
                          <Avatar name={owner.name} color={owner.avatarColor} size="xs" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-ink">{owner.name}</span>
                            {owner.position && (
                              <span className="block truncate text-[11px] text-ink-faint">
                                {owner.position}
                              </span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <span className="text-sm font-bold text-ink">
                          {formatCurrencyShort(owner.wonAmount)}
                        </span>
                        <span className="block text-[11px] text-ink-faint">{owner.wonCount}건</span>
                      </td>
                      <td className="px-3 py-3 text-right text-xs whitespace-nowrap text-ink-soft">
                        {formatCurrencyShort(owner.openAmount)}
                      </td>
                      <td className="px-3 py-3 text-right text-xs whitespace-nowrap text-ink-soft">
                        {owner.targetAmount > 0 ? formatCurrencyShort(owner.targetAmount) : '-'}
                      </td>
                      <td className="px-5 py-3">
                        {owner.targetAmount > 0 ? (
                          <Progress
                            value={owner.achievement}
                            tone={
                              owner.achievement >= 100
                                ? 'positive'
                                : owner.achievement >= 70
                                  ? 'brand'
                                  : 'caution'
                            }
                            label={`${owner.name} 달성률`}
                          />
                        ) : (
                          <span className="text-xs text-ink-faint">목표 미설정</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 주요 거래처 */}
        <Card>
          <CardHeader title="수주 기여 거래처" description="수주 금액 상위" />
          {report.topClients.length === 0 ? (
            <CardBody>
              <EmptyState title="집계할 거래처가 없습니다." />
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {report.topClients.map((client) => {
                const share = summary.wonAmount > 0 ? percent(client.wonAmount, summary.wonAmount) : 0;

                return (
                  <li key={client.id} className="px-5 py-3">
                    <Link href={`/clients/${client.id}`} className="group block">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
                          {client.grade}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink group-hover:text-brand">
                          {client.name}
                        </span>
                        <span className="text-sm font-bold whitespace-nowrap text-ink">
                          {formatCurrencyShort(client.wonAmount)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${share}%` }} />
                        </div>
                        <span className="text-[11px] text-ink-faint">
                          {client.wonCount}건 · {share}%
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* 계약 진행 현황 */}
        <Card>
          <CardHeader
            title="수주 건의 계약 진행 현황"
            description="수주 이후 계약서 작성 · 검토 · 체결 단계"
          />
          {report.contractMix.length === 0 ? (
            <CardBody>
              <EmptyState title="집계할 계약이 없습니다." />
            </CardBody>
          ) : (
            <CardBody className="space-y-2.5">
              {report.contractMix.map((row) => (
                <div key={row.status} className="flex items-center gap-3">
                  <div className="w-24 shrink-0">
                    <ContractStatusBadge value={row.status} />
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${summary.wonCount > 0 ? percent(row.count, summary.wonCount) : 0}%`,
                      }}
                      title={CONTRACT_STATUS_LABEL[row.status as ContractStatus]}
                    />
                  </div>
                  <span className="w-28 shrink-0 text-right text-xs text-ink-soft">
                    {row.count}건 · {formatCurrencyShort(row.amount)}
                  </span>
                </div>
              ))}
            </CardBody>
          )}
        </Card>

        {/* 실패 원인 */}
        <Card>
          <CardHeader title="실패 원인 분석" description={`${report.year}년 실패 처리된 영업건`} />
          {report.lostReasons.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={<CircleSlash className="size-5" />}
                title="실패로 종료된 영업건이 없습니다."
              />
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {report.lostReasons.map((row) => (
                <li key={row.reason} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{row.reason}</span>
                  <Badge tone="danger">{row.count}건</Badge>
                  <span className="w-20 text-right text-xs text-ink-faint">
                    {formatCurrencyShort(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 영업 목표 관리 */}
      <Card className="mt-4">
        <CardHeader
          title={`${report.year}년 영업 목표`}
          description="셀을 클릭해 담당자별 월 목표를 설정합니다. 설정한 목표는 대시보드 목표선에 반영됩니다."
        />
        <SalesTargetPanel year={report.year} rows={targets} canEdit />
      </Card>

      <p className="mt-4 text-center text-[11px] text-ink-faint">
        집계 기준: 수주 실적은 단계가 수주(WON)로 확정된 시점, 파이프라인 예측은 단계별 수주 확률
        가중치를 적용한 금액입니다. 총 수주 금액 {formatCurrency(summary.wonAmount)}
      </p>
    </>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  tone = 'neutral',
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'brand';
  progress?: number;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-lg',
            tone === 'brand' ? 'bg-brand-soft text-brand' : 'bg-surface-muted text-ink-soft',
          )}
        >
          {icon}
        </span>
        <p className="text-xs text-ink-faint">{label}</p>
      </div>
      <p
        className={cn(
          'mt-2 text-xl font-bold tracking-tight',
          tone === 'brand' ? 'text-brand' : 'text-ink',
        )}
      >
        {value}
      </p>
      {progress !== undefined ? (
        <div className="mt-2">
          <Progress
            value={progress}
            tone={progress >= 100 ? 'positive' : progress >= 70 ? 'brand' : 'caution'}
            label={label}
          />
        </div>
      ) : null}
      {sub && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
    </Card>
  );
}
