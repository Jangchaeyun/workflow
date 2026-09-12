import type { Metadata } from 'next';
import { Activity, ChevronDown, LogIn, ScrollText, ShieldAlert, Users } from 'lucide-react';

import { requirePermission } from '@/lib/auth';
import { getActivityLogs, getLogOverview, type LogFilters } from '@/data/admin';
import {
  FIELD_LABEL,
  LOG_ACTION_LABEL,
  LOG_ENTITY_LABEL,
  type LogAction,
} from '@/lib/constants';
import { cn, formatDateTime, formatRelativeTime } from '@/lib/utils';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { RoleBadge } from '@/components/ui/StatusBadge';
import { LogFilterBar } from '@/components/admin/LogFilterBar';

export const metadata: Metadata = { title: '활동 로그' };

/** 동작 종류별 배지 색. 위험한 동작(삭제·접근거부)이 눈에 먼저 들어오게 한다. */
const ACTION_TONE: Record<LogAction, BadgeTone> = {
  CREATE: 'positive',
  UPDATE: 'info',
  DELETE: 'danger',
  LOGIN: 'neutral',
  LOGOUT: 'neutral',
  STATUS_CHANGE: 'brand',
  PERMISSION_CHANGE: 'caution',
  ACCESS_DENIED: 'danger',
};

export default async function AdminLogsPage({ searchParams }: PageProps<'/admin/logs'>) {
  await requirePermission('log:read');

  const raw = await searchParams;
  const filters: LogFilters = {
    q: pick(raw.q),
    action: pick(raw.action),
    entity: pick(raw.entity),
    user: pick(raw.user),
    range: pick(raw.range),
    page: pick(raw.page),
  };

  const [result, overview] = await Promise.all([getActivityLogs(filters), getLogOverview()]);

  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value)),
  ) as Record<string, string>;

  return (
    <>
      <PageHeader
        title="활동 로그"
        description="누가 언제 무엇을 바꿨는지 추적합니다. 변경 전후 값과 접근 거부 시도까지 기록됩니다."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Activity className="size-4" />}
          label="최근 7일 활동"
          value={`${overview.weekTotal.toLocaleString('ko-KR')}건`}
        />
        <StatTile
          icon={<Users className="size-4" />}
          label="활동 사용자"
          value={`${overview.activeActorCount}명`}
        />
        <StatTile
          icon={<LogIn className="size-4" />}
          label="로그인"
          value={`${overview.loginCount}회`}
        />
        <StatTile
          icon={<ShieldAlert className="size-4" />}
          label="접근 거부"
          value={`${overview.denied}건`}
          tone={overview.denied > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <LogFilterBar
        actors={result.actors}
        entityTypes={result.entityTypes}
        actionCounts={result.actionCounts}
      />

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-5" />}
            title="조건에 맞는 활동 기록이 없습니다."
            description="검색어나 기간 필터를 조정해보세요."
          />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {result.items.map((log) => (
                <li key={log.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    {log.user ? (
                      <Avatar name={log.user.name} color={log.user.avatarColor} size="sm" />
                    ) : (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10px] font-bold text-ink-faint">
                        SYS
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={ACTION_TONE[log.action as LogAction] ?? 'neutral'}>
                          {LOG_ACTION_LABEL[log.action as LogAction] ?? log.action}
                        </Badge>
                        <Badge>{LOG_ENTITY_LABEL[log.entityType] ?? log.entityType}</Badge>
                        <span className="text-sm font-medium text-ink">
                          {log.user?.name ?? '시스템'}
                        </span>
                        {log.user && <RoleBadge value={log.user.role} />}
                        <span
                          className="ml-auto text-[11px] whitespace-nowrap text-ink-faint"
                          title={formatDateTime(log.createdAt)}
                        >
                          {formatRelativeTime(log.createdAt)}
                        </span>
                      </div>

                      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{log.summary}</p>

                      <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-faint">
                        <span>{formatDateTime(log.createdAt)}</span>
                        {log.ipAddress && <span>IP {log.ipAddress}</span>}
                        {log.entityId && <span className="font-mono">#{log.entityId}</span>}
                      </p>

                      {/* 변경 전후 스냅샷. 기본은 접어두고 필요할 때만 펼친다. */}
                      {log.changes && log.changes.length > 0 && (
                        <details className="group mt-2">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-brand hover:text-brand-dark">
                            <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
                            변경 내역 {log.changes.length}건
                          </summary>

                          <div className="mt-2 overflow-hidden rounded-lg border border-line">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-surface-muted text-left text-ink-faint">
                                  <th className="px-3 py-1.5 font-medium">항목</th>
                                  <th className="px-3 py-1.5 font-medium">변경 전</th>
                                  <th className="px-3 py-1.5 font-medium">변경 후</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-line">
                                {log.changes.map((change) => (
                                  <tr key={change.field}>
                                    <td className="px-3 py-1.5 font-medium text-ink-soft">
                                      {FIELD_LABEL[change.field] ?? change.field}
                                    </td>
                                    <td className="px-3 py-1.5 text-ink-faint line-through">
                                      {formatValue(change.before)}
                                    </td>
                                    <td className="px-3 py-1.5 font-medium text-ink">
                                      {formatValue(change.after)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={result.page}
              total={result.total}
              pageSize={result.pageSize}
              basePath="/admin/logs"
              query={query}
            />
          </>
        )}
      </Card>

      <p className="mt-4 text-center text-[11px] text-ink-faint">
        로그는 서버 액션에서 자동으로 기록되며 임의로 수정·삭제할 수 없습니다.
      </p>
    </>
  );
}

/** ISO 날짜·불리언·빈 값을 사람이 읽을 수 있는 형태로 정리 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(없음)';
  if (typeof value === 'boolean') return value ? '예' : '아니오';

  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
    return value.length > 60 ? `${value.slice(0, 60)}…` : value;
  }

  if (typeof value === 'number') return value.toLocaleString('ko-KR');
  return JSON.stringify(value);
}

function StatTile({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <div className="card flex items-center gap-3 px-5 py-4">
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-lg',
          tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-surface-muted text-ink-soft',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-ink-faint">{label}</p>
        <p className="text-base font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}
