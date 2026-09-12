import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, ShieldCheck, UserCheck, UserCog, Users } from 'lucide-react';

import { getCurrentUser, getMyPermissions, requirePermission } from '@/lib/auth';
import {
  getUserFormOptions,
  getUserList,
  getUserOverview,
  type UserFilters,
} from '@/data/admin';
import { ROLE_LABEL, USER_STATUSES, USER_STATUS_LABEL, type Role } from '@/lib/constants';
import { buildQueryString, cn, formatDate, formatRelativeTime, toDateInputValue } from '@/lib/utils';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { RoleBadge, UserStatusBadge } from '@/components/ui/StatusBadge';
import { UserFilterBar } from '@/components/admin/UserFilterBar';
import { UserCreateButton, UserEditButton } from '@/components/admin/UserFormModal';
import { UserRowActions } from '@/components/admin/UserRowActions';

export const metadata: Metadata = { title: '직원 관리' };

export default async function AdminUsersPage({ searchParams }: PageProps<'/admin/users'>) {
  await requirePermission('user:read');

  const raw = await searchParams;
  const filters: UserFilters = {
    q: pick(raw.q),
    role: pick(raw.role),
    status: pick(raw.status),
    department: pick(raw.department),
    sort: pick(raw.sort),
    page: pick(raw.page),
  };

  const [me, permissions, options, overview, result] = await Promise.all([
    getCurrentUser(),
    getMyPermissions(),
    getUserFormOptions(),
    getUserOverview(),
    getUserList(filters),
  ]);

  const canCreate = permissions.has('user:create');
  const canUpdate = permissions.has('user:update');
  const canApprove = permissions.has('user:approve');
  const canDelete = permissions.has('user:delete');

  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value)),
  ) as Record<string, string>;

  const totalByStatus = Object.values(result.statusCounts).reduce((sum, value) => sum + value, 0);

  return (
    <>
      <PageHeader
        title="직원 관리"
        description="가입 승인, 역할 배정, 계정 상태를 관리합니다."
        action={
          <>
            <Link
              href="/admin/permissions"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-surface px-3 text-sm font-medium text-ink ring-1 ring-line-strong ring-inset transition-colors hover:bg-surface-muted"
            >
              <ShieldCheck className="size-4" />
              권한 관리
            </Link>
            {canCreate && <UserCreateButton options={options} />}
          </>
        }
      />

      {/* 승인 대기가 있으면 가장 먼저 처리하도록 상단에 알린다. */}
      {overview.pending > 0 && canApprove && (
        <Link
          href={`/admin/users${buildQueryString({}, { status: 'PENDING' })}`}
          className="mb-4 flex items-center gap-2.5 rounded-xl border border-caution/30 bg-caution-soft px-4 py-3 transition-colors hover:border-caution/60"
        >
          <UserCheck className="size-4 shrink-0 text-caution" />
          <p className="text-sm font-medium text-caution">
            승인 대기 중인 가입 신청이 {overview.pending}건 있습니다.
          </p>
          <span className="ml-auto text-xs font-medium text-caution">바로 보기 →</span>
        </Link>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={<Users className="size-4" />} label="재직 인원" value={`${overview.total}명`} />
        <StatTile
          icon={<UserCheck className="size-4" />}
          label="승인 대기"
          value={`${overview.pending}명`}
          tone={overview.pending > 0 ? 'caution' : 'neutral'}
        />
        <StatTile
          icon={<UserCog className="size-4" />}
          label="이용정지"
          value={`${overview.suspended}명`}
          tone={overview.suspended > 0 ? 'danger' : 'neutral'}
        />
        <StatTile
          icon={<Building2 className="size-4" />}
          label="이번 달 신규"
          value={`${overview.joinedThisMonth}명`}
        />
      </div>

      {/* 계정 상태 탭 */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <StatusTab
          href={`/admin/users${buildQueryString(query, { status: undefined, page: undefined })}`}
          active={!filters.status}
          label="전체"
          count={totalByStatus}
        />
        {USER_STATUSES.map((status) => (
          <StatusTab
            key={status}
            href={`/admin/users${buildQueryString(query, { status, page: undefined })}`}
            active={filters.status === status}
            label={USER_STATUS_LABEL[status]}
            count={result.statusCounts[status] ?? 0}
          />
        ))}
      </div>

      <UserFilterBar
        departments={options.departments.map((department) => ({
          id: department.id,
          name: department.name,
        }))}
      />

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="조건에 맞는 직원이 없습니다."
            description="검색어나 필터를 조정해보세요."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-faint">
                    <th className="px-5 py-3 font-medium">직원</th>
                    <th className="px-3 py-3 font-medium">역할</th>
                    <th className="px-3 py-3 font-medium">상태</th>
                    <th className="px-3 py-3 font-medium">부서 · 직위</th>
                    <th className="px-3 py-3 font-medium">담당 현황</th>
                    <th className="px-3 py-3 font-medium">최근 로그인</th>
                    <th className="px-5 py-3 text-right font-medium">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.items.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-surface-muted">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={user.name} color={user.avatarColor} size="sm" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                              {user.name}
                              {user.id === me?.id && (
                                <span className="rounded bg-brand-soft px-1 py-0.5 text-[10px] font-bold text-brand-dark">
                                  나
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-ink-faint">{user.email}</p>
                            {user.employeeNo && (
                              <p className="font-mono text-[11px] text-ink-faint">
                                {user.employeeNo}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <RoleBadge value={user.role} />
                      </td>
                      <td className="px-3 py-3">
                        <UserStatusBadge value={user.status} />
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-soft">
                        <p>{user.departmentName ?? '부서 미지정'}</p>
                        <p className="text-ink-faint">{user.position ?? '-'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {user.openTaskCount > 0 && <Badge>업무 {user.openTaskCount}</Badge>}
                          {user.clientCount > 0 && <Badge tone="info">거래처 {user.clientCount}</Badge>}
                          {user.dealCount > 0 && <Badge tone="brand">영업 {user.dealCount}</Badge>}
                          {user.openTaskCount === 0 &&
                            user.clientCount === 0 &&
                            user.dealCount === 0 && (
                              <span className="text-xs text-ink-faint">-</span>
                            )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap text-ink-soft">
                        {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : '이력 없음'}
                        <span className="block text-[11px] text-ink-faint">
                          입사 {formatDate(user.hireDate)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col items-end gap-1">
                          {canUpdate && (
                            <UserEditButton
                              options={options}
                              initial={{
                                id: user.id,
                                email: user.email,
                                name: user.name,
                                role: user.role,
                                status: user.status,
                                employeeNo: user.employeeNo,
                                position: user.position,
                                phone: user.phone,
                                departmentId: user.departmentId,
                                hireDate: toDateInputValue(user.hireDate) || null,
                              }}
                            />
                          )}
                          <UserRowActions
                            userId={user.id}
                            userName={user.name}
                            status={user.status}
                            canApprove={canApprove}
                            canDelete={canDelete}
                            isSelf={user.id === me?.id}
                            openTaskCount={user.openTaskCount}
                            dealCount={user.dealCount}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일 */}
            <ul className="divide-y divide-line lg:hidden">
              {result.items.map((user) => (
                <li key={user.id} className="px-4 py-3.5">
                  <div className="flex items-start gap-2.5">
                    <Avatar name={user.name} color={user.avatarColor} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{user.name}</p>
                      <p className="truncate text-xs text-ink-faint">{user.email}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <RoleBadge value={user.role} />
                        <UserStatusBadge value={user.status} />
                      </div>
                      <p className="mt-1 text-xs text-ink-faint">
                        {[user.departmentName, user.position].filter(Boolean).join(' · ') || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1">
                    {canUpdate && (
                      <UserEditButton
                        options={options}
                        initial={{
                          id: user.id,
                          email: user.email,
                          name: user.name,
                          role: user.role,
                          status: user.status,
                          employeeNo: user.employeeNo,
                          position: user.position,
                          phone: user.phone,
                          departmentId: user.departmentId,
                          hireDate: toDateInputValue(user.hireDate) || null,
                        }}
                      />
                    )}
                    <UserRowActions
                      userId={user.id}
                      userName={user.name}
                      status={user.status}
                      canApprove={canApprove}
                      canDelete={canDelete}
                      isSelf={user.id === me?.id}
                      openTaskCount={user.openTaskCount}
                      dealCount={user.dealCount}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={result.page}
              total={result.total}
              pageSize={result.pageSize}
              basePath="/admin/users"
              query={query}
            />
          </>
        )}
      </Card>

      {/* 역할 분포 요약 */}
      <Card className="mt-4 px-5 py-4">
        <h2 className="text-xs font-bold text-ink">역할 분포</h2>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
            <li key={role} className="flex items-center gap-2 text-xs">
              <RoleBadge value={role} />
              <span className="font-medium text-ink">{result.roleCounts[role] ?? 0}명</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
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
  tone?: 'neutral' | 'caution' | 'danger';
}) {
  return (
    <div className="card flex items-center gap-3 px-5 py-4">
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-lg',
          tone === 'caution'
            ? 'bg-caution-soft text-caution'
            : tone === 'danger'
              ? 'bg-danger-soft text-danger'
              : 'bg-surface-muted text-ink-soft',
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

function StatusTab({
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
