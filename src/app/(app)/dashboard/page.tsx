import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlarmClock,
  Building2,
  CalendarClock,
  CheckCircle2,
  Loader,
  UserX,
} from 'lucide-react';

import { requirePermission, getMyPermissions } from '@/lib/auth';
import { getDashboardData } from '@/data/dashboard';
import { ROLE_LABEL } from '@/lib/constants';
import { formatCurrencyShort, formatDate, formatNumber, percent } from '@/lib/utils';

import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  DashboardQuickActions,
  greetingForHour,
} from '@/components/dashboard/DashboardQuickActions';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { Progress } from '@/components/ui/Progress';
import { TaskListRow } from '@/components/tasks/TaskListRow';
import { TaskTrendChart } from '@/components/charts/TaskTrendChart';
import { StatusDonutChart } from '@/components/charts/StatusDonutChart';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { DEAL_STAGE_COLORS } from '@/components/charts/chartTheme';

export const metadata: Metadata = { title: '대시보드' };

export default async function DashboardPage() {
  const user = await requirePermission('dashboard:view');
  const [data, permissions] = await Promise.all([getDashboardData(), getMyPermissions()]);

  const today = new Date();
  const scopeNote = data.workload
    ? '조직 전체 기준'
    : '내가 담당·요청·참조 중인 업무 기준';
  const greeting = greetingForHour(today.getHours());

  return (
    <>
      <PageHeader
        title={`${user.name}님, ${greeting}`}
        description={`${ROLE_LABEL[user.role]}${user.departmentName ? ` · ${user.departmentName}` : ''} · ${formatDate(today)} 기준`}
        meta={<p className="text-xs text-ink-faint">집계 범위: {scopeNote}</p>}
      />

      <div className="space-y-5">
        <DashboardQuickActions
          canCreateTask={permissions.has('task:create')}
          canReadClients={permissions.has('client:read')}
          canReadDeals={
            permissions.has('deal:read:own') || permissions.has('deal:read:all')
          }
        />

        {/* KPI */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="오늘의 업무"
            value={data.kpi.dueToday}
            unit="건"
            hint="오늘 마감 예정인 미완료 업무"
            icon={CalendarClock}
            tone="brand"
            href="/tasks?due=today"
          />
          <StatCard
            label="진행 중"
            value={data.kpi.inProgress}
            unit="건"
            hint="담당자가 착수한 업무"
            icon={Loader}
            tone="info"
            href="/tasks?status=IN_PROGRESS"
          />
          <StatCard
            label="이번 달 완료"
            value={data.kpi.doneThisMonth}
            unit="건"
            hint={`${today.getMonth() + 1}월 완료 처리된 업무`}
            icon={CheckCircle2}
            tone="positive"
            href="/tasks?status=DONE"
          />
          {data.kpi.overdue > 0 || data.kpi.newClients === null ? (
            <StatCard
              label="마감 초과"
              value={data.kpi.overdue}
              unit="건"
              hint="마감일이 지난 미완료 업무"
              icon={AlarmClock}
              tone={data.kpi.overdue > 0 ? 'danger' : 'positive'}
              href="/tasks?due=overdue"
            />
          ) : (
            <StatCard
              label="신규 거래처"
              value={data.kpi.newClients ?? 0}
              unit="곳"
              hint={`${today.getMonth() + 1}월 신규 등록`}
              icon={Building2}
              tone="caution"
              href="/clients"
            />
          )}
        </div>

        {/* 미배정 업무는 팀장·관리자에게만 의미가 있어 별도 배너로 노출한다. */}
        {data.kpi.unassigned !== null && data.kpi.unassigned > 0 && (
          <Link
            href="/tasks?assignee=none"
            className="flex items-center gap-3 rounded-xl border border-caution/30 bg-caution-soft px-4 py-3 transition-colors hover:border-caution/60"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/70 text-caution">
              <UserX className="size-4" />
            </span>
            <p className="text-xs text-ink-soft">
              담당자가 지정되지 않은 업무가{' '}
              <strong className="text-caution">{data.kpi.unassigned}건</strong> 있습니다. 배정이
              필요합니다.
            </p>
          </Link>
        )}

        {/* 업무 현황 */}
        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardHeader
              title="업무 처리 추이"
              description="최근 8주간 주별 등록 대비 완료 건수"
            />
            <CardBody>
              <TaskTrendChart data={data.weeklyTrend} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="상태별 분포" description="현재 조회 범위의 업무 상태 구성" />
            <CardBody>
              <StatusDonutChart data={data.statusDistribution} />
            </CardBody>
          </Card>
        </div>

        {/* 영업 현황 */}
        {(data.pipeline || data.monthlyRevenue) && (
          <div className="grid gap-5 xl:grid-cols-2">
            {data.pipeline && (
              <Card>
                <CardHeader
                  title="영업 파이프라인"
                  description="단계별 금액과 수주 확률 반영 예상 매출"
                  moreHref="/sales"
                />
                <CardBody className="space-y-3.5">
                  {data.pipeline.every((stage) => stage.count === 0) ? (
                    <EmptyState title="진행 중인 영업건이 없습니다." />
                  ) : (
                    <>
                      {(() => {
                        const max = Math.max(...data.pipeline.map((stage) => stage.amount), 1);
                        return data.pipeline.map((stage) => (
                          <div key={stage.stage} className="space-y-1.5">
                            <div className="flex items-baseline justify-between gap-2 text-xs">
                              <span className="font-medium text-ink">
                                {stage.label}
                                <span className="ml-1.5 text-ink-faint">{stage.count}건</span>
                              </span>
                              <span className="text-ink-soft">
                                {formatCurrencyShort(stage.amount)}
                                <span className="ml-1.5 text-ink-faint">
                                  (예상 {formatCurrencyShort(stage.weighted)})
                                </span>
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-line">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(2, (stage.amount / max) * 100)}%`,
                                  backgroundColor: DEAL_STAGE_COLORS[stage.stage],
                                }}
                              />
                            </div>
                          </div>
                        ));
                      })()}

                      <div className="flex items-center justify-between border-t border-line pt-3 text-xs">
                        <span className="text-ink-soft">가중 예상 매출 합계</span>
                        <span className="font-bold text-ink">
                          {formatCurrencyShort(
                            data.pipeline.reduce((sum, stage) => sum + stage.weighted, 0),
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </CardBody>
              </Card>
            )}

            {data.monthlyRevenue && (
              <Card>
                <CardHeader
                  title="월별 수주 실적"
                  description="최근 6개월 수주 금액과 목표 달성 현황"
                  moreHref="/sales/reports"
                />
                <CardBody>
                  <RevenueChart data={data.monthlyRevenue} height={220} />
                  {(() => {
                    const current = data.monthlyRevenue.at(-1);
                    if (!current) return null;
                    return (
                      <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="text-ink-soft">{current.label} 목표 달성률</span>
                          <span className="font-medium text-ink">
                            {formatCurrencyShort(current.revenue)} /{' '}
                            {formatCurrencyShort(current.target)}
                          </span>
                        </div>
                        <Progress
                          value={percent(current.revenue, current.target)}
                          tone={current.revenue >= current.target ? 'positive' : 'brand'}
                          label="목표 달성률"
                        />
                      </div>
                    );
                  })()}
                </CardBody>
              </Card>
            )}
          </div>
        )}

        {/* 목록 영역 */}
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="최근 등록 업무" moreHref="/tasks" />
            {data.recentTasks.length === 0 ? (
              <EmptyState title="등록된 업무가 없습니다." description="업무를 등록하면 여기에 표시됩니다." />
            ) : (
              <ul className="divide-y divide-line">
                {data.recentTasks.map((task) => (
                  <TaskListRow key={task.id} task={task} />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="마감 임박 · 지연 업무"
              description="7일 내 마감 예정이거나 이미 지난 업무"
              moreHref="/tasks?due=week"
            />
            {data.dueSoonTasks.length === 0 ? (
              <EmptyState
                title="마감이 임박한 업무가 없습니다."
                description="현재 일정에 여유가 있습니다."
              />
            ) : (
              <ul className="divide-y divide-line">
                {data.dueSoonTasks.map((task) => (
                  <TaskListRow key={task.id} task={task} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {data.workload && (
            <Card>
              <CardHeader
                title="담당자별 업무 부하"
                description="미완료 업무 기준 상위 담당자"
                moreHref="/admin/users"
                moreLabel="직원 관리"
              />
              {data.workload.length === 0 ? (
                <EmptyState title="표시할 담당자가 없습니다." />
              ) : (
                <CardBody className="space-y-3.5">
                  {(() => {
                    const max = Math.max(...data.workload.map((row) => row.open), 1);
                    return data.workload.map((row) => (
                      <div key={row.userId} className="flex items-center gap-3">
                        <Avatar name={row.name} color={row.avatarColor} size="xs" />
                        <span className="w-16 shrink-0 truncate text-xs text-ink">{row.name}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${Math.max(2, (row.open / max) * 100)}%` }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right text-xs text-ink-soft">
                          {formatNumber(row.open)}건
                        </span>
                        <span
                          className={`w-16 shrink-0 text-right text-[11px] ${row.overdue > 0 ? 'text-danger' : 'text-ink-faint'}`}
                        >
                          {row.overdue > 0 ? `지연 ${row.overdue}건` : '지연 없음'}
                        </span>
                      </div>
                    ));
                  })()}
                </CardBody>
              )}
            </Card>
          )}

          {data.followUps && (
            <Card>
              <CardHeader
                title="후속 조치 예정 상담"
                description="상담 기록에 등록된 다음 액션"
                moreHref="/clients"
                moreLabel="거래처"
              />
              {data.followUps.length === 0 ? (
                <EmptyState
                  title="예정된 후속 조치가 없습니다."
                  description="상담 기록에 다음 액션을 등록하면 여기에 모입니다."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {data.followUps.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/clients/${row.clientId}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{row.nextAction}</p>
                          <p className="truncate text-xs text-ink-faint">
                            {row.clientName} · 담당 {row.userName}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-ink-soft">
                          {formatDate(row.nextActionAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
