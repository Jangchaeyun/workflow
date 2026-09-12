import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Handshake, MessageCircle, Phone } from 'lucide-react';

import { getMyPermissions, requirePermission } from '@/lib/auth';
import { getClientList, getClientOwnerOptions, type ClientFilters } from '@/data/clients';
import {
  CLIENT_SCALE_LABEL,
  CLIENT_STATUSES,
  CLIENT_STATUS_LABEL,
  type ClientScale,
} from '@/lib/constants';
import { buildQueryString, cn, formatCurrencyShort, formatDate } from '@/lib/utils';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Avatar } from '@/components/ui/Avatar';
import { ExportCsvButton } from '@/components/ui/ExportCsvButton';
import { ClientStatusBadge } from '@/components/ui/StatusBadge';
import { ClientFilterBar } from '@/components/clients/ClientFilterBar';
import { ClientCreateButton } from '@/components/clients/ClientFormModal';

export const metadata: Metadata = { title: '거래처' };

const GRADE_TONE = {
  A: 'bg-brand text-white',
  B: 'bg-info-soft text-info',
  C: 'bg-surface-muted text-ink-soft',
  D: 'bg-danger-soft text-danger',
} as const;

export default async function ClientsPage({ searchParams }: PageProps<'/clients'>) {
  await requirePermission('client:read');

  const raw = await searchParams;
  const filters: ClientFilters = {
    q: pick(raw.q),
    status: pick(raw.status),
    grade: pick(raw.grade),
    scale: pick(raw.scale),
    owner: pick(raw.owner),
    sort: pick(raw.sort),
    page: pick(raw.page),
  };

  const [permissions, owners, result] = await Promise.all([
    getMyPermissions(),
    getClientOwnerOptions(),
    getClientList(filters),
  ]);

  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value)),
  ) as Record<string, string>;

  const totalAll = Object.values(result.statusCounts).reduce((sum, value) => sum + value, 0);

  return (
    <>
      <PageHeader
        title="거래처"
        description="거래처 정보와 담당자, 상담 이력을 관리합니다."
        action={
          <>
            <ExportCsvButton type="clients" query={{ status: filters.status }} />
            {permissions.has('client:create') && <ClientCreateButton owners={owners} />}
          </>
        }
      />

      {/* 거래 상태 탭 */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {[{ value: undefined, label: '전체', count: totalAll }, ...CLIENT_STATUSES.map((status) => ({
          value: status as string | undefined,
          label: CLIENT_STATUS_LABEL[status],
          count: result.statusCounts[status] ?? 0,
        }))].map((tab) => {
          const selected = (filters.status ?? undefined) === tab.value;
          return (
            <Link
              key={tab.value ?? 'all'}
              href={`/clients${buildQueryString(query, { status: tab.value, page: undefined })}`}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                selected
                  ? 'border-brand bg-brand text-white'
                  : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
              )}
            >
              {tab.label}
              <span className={cn('text-[11px]', selected ? 'text-white/75' : 'text-ink-faint')}>
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      <ClientFilterBar owners={owners.map((owner) => ({ id: owner.id, name: owner.name }))} />

      {result.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="조건에 맞는 거래처가 없습니다."
            description="검색어나 필터를 조정해보세요."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="card group flex flex-col px-5 py-4 transition-colors hover:border-line-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-ink-faint">{client.code}</span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-bold',
                          GRADE_TONE[client.grade as keyof typeof GRADE_TONE] ?? GRADE_TONE.C,
                        )}
                      >
                        {client.grade}
                      </span>
                    </div>
                    <h2 className="mt-1 truncate text-sm font-bold text-ink group-hover:text-brand">
                      {client.name}
                    </h2>
                    <p className="truncate text-xs text-ink-faint">
                      {[client.industry, CLIENT_SCALE_LABEL[client.scale as ClientScale]]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <ClientStatusBadge value={client.status} />
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-center">
                  <div>
                    <dt className="text-[10px] text-ink-faint">담당자</dt>
                    <dd className="text-xs font-bold text-ink">{client.contactCount}명</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-ink-faint">영업건</dt>
                    <dd className="text-xs font-bold text-ink">{client.dealCount}건</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-ink-faint">누적 수주</dt>
                    <dd className="text-xs font-bold text-ink">
                      {formatCurrencyShort(client.wonAmount)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 space-y-1.5 text-xs text-ink-soft">
                  {client.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="size-3.5 text-ink-faint" />
                      {client.phone}
                    </p>
                  )}
                  {client.lastConsultation ? (
                    <p className="flex items-center gap-1.5">
                      <MessageCircle className="size-3.5 text-ink-faint" />
                      <span className="truncate">
                        {formatDate(client.lastConsultation.consultedAt)} ·{' '}
                        {client.lastConsultation.title}
                      </span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-ink-faint">
                      <MessageCircle className="size-3.5" />
                      상담 기록 없음
                    </p>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-2 border-t border-line pt-3">
                  {client.owner ? (
                    <>
                      <Avatar name={client.owner.name} color={client.owner.avatarColor} size="xs" />
                      <span className="text-xs text-ink-soft">담당 {client.owner.name}</span>
                    </>
                  ) : (
                    <span className="text-xs text-ink-faint">담당 미지정</span>
                  )}
                  {client.consultationCount > 0 && (
                    <Badge className="ml-auto">
                      <Handshake className="size-3" />
                      상담 {client.consultationCount}
                    </Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>

          <Card className="mt-4">
            <Pagination
              page={result.page}
              total={result.total}
              pageSize={result.pageSize}
              basePath="/clients"
              query={query}
            />
          </Card>
        </>
      )}
    </>
  );
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}
