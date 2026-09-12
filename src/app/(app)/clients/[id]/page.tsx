import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, Globe, Mail, MapPin, Phone, Receipt, UserRound } from 'lucide-react';

import { getMyPermissions, requirePermission } from '@/lib/auth';
import { getClientDetail, getClientOwnerOptions } from '@/data/clients';
import { getDealFormOptions } from '@/data/deals';
import { CLIENT_SCALE_LABEL, type ClientScale } from '@/lib/constants';
import { formatCurrency, formatCurrencyShort, formatDate, percent } from '@/lib/utils';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Avatar, UserChip } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Progress } from '@/components/ui/Progress';
import {
  ClientStatusBadge,
  ContractStatusBadge,
  DealStageBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
} from '@/components/ui/StatusBadge';
import { ClientEditButton } from '@/components/clients/ClientFormModal';
import { ContactManager } from '@/components/clients/ContactManager';
import { ConsultationPanel } from '@/components/clients/ConsultationPanel';
import { DealCreateButton } from '@/components/sales/DealFormModal';

export const metadata: Metadata = { title: '거래처 상세' };

export default async function ClientDetailPage({ params, searchParams }: PageProps<'/clients/[id]'>) {
  const user = await requirePermission('client:read');
  const { id } = await params;
  const { tab: rawTab } = await searchParams;

  const [client, permissions] = await Promise.all([getClientDetail(id), getMyPermissions()]);
  if (!client) notFound();

  const canUpdate = permissions.has('client:update');
  const canManageContacts = permissions.has('contact:manage');
  const canReadConsultations = permissions.has('consultation:read');
  const canCreateConsultations = permissions.has('consultation:create');
  const canReadDeals = permissions.has('deal:read:own') || permissions.has('deal:read:all');
  const canCreateDeals = permissions.has('deal:create');

  const [owners, dealOptions] = await Promise.all([
    canUpdate ? getClientOwnerOptions() : Promise.resolve([]),
    canCreateDeals ? getDealFormOptions() : Promise.resolve(null),
  ]);

  const wonDeals = client.deals.filter((deal) => deal.stage === 'WON');
  const openDeals = client.deals.filter((deal) => !['WON', 'LOST'].includes(deal.stage));
  const wonAmount = wonDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const openAmount = openDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const closedCount = client.deals.filter((deal) => ['WON', 'LOST'].includes(deal.stage)).length;
  const winRate = closedCount > 0 ? percent(wonDeals.length, closedCount) : 0;

  const tabs = [
    { value: 'overview', label: '개요' },
    { value: 'contacts', label: '담당자', count: client.contacts.length },
    ...(canReadConsultations
      ? [{ value: 'consultations', label: '상담 기록', count: client.consultations.length }]
      : []),
    ...(canReadDeals ? [{ value: 'deals', label: '영업건', count: client.deals.length }] : []),
    { value: 'tasks', label: '관련 업무', count: client.tasks.length },
  ];

  const tab =
    typeof rawTab === 'string' && tabs.some((item) => item.value === rawTab) ? rawTab : 'overview';

  return (
    <>
      <PageHeader
        backHref="/clients"
        backLabel="거래처 목록"
        title={client.name}
        meta={
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="font-mono text-xs text-ink-faint">{client.code}</span>
            <ClientStatusBadge value={client.status} />
            <Badge tone={client.grade === 'A' ? 'brand' : 'neutral'}>{client.grade}등급</Badge>
            <span className="text-xs text-ink-faint">
              {[client.industry, CLIENT_SCALE_LABEL[client.scale as ClientScale]]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        }
        action={
          canUpdate && (
            <ClientEditButton
              owners={owners}
              initial={{
                id: client.id,
                name: client.name,
                businessNo: client.businessNo,
                ceoName: client.ceoName,
                industry: client.industry,
                scale: client.scale,
                grade: client.grade,
                status: client.status,
                phone: client.phone,
                email: client.email,
                website: client.website,
                address: client.address,
                memo: client.memo,
                ownerId: client.ownerId,
              }}
            />
          )
        }
      />

      {/* 거래 요약 */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="누적 수주 금액" value={formatCurrencyShort(wonAmount)} sub={`${wonDeals.length}건 수주`} />
        <SummaryCard label="진행 중 영업" value={formatCurrencyShort(openAmount)} sub={`${openDeals.length}건 진행`} />
        <SummaryCard
          label="수주 성공률"
          value={`${winRate}%`}
          sub={closedCount > 0 ? `종료 ${closedCount}건 기준` : '종료된 영업건 없음'}
        >
          <Progress value={winRate} tone={winRate >= 50 ? 'positive' : 'caution'} label="수주 성공률" />
        </SummaryCard>
        <SummaryCard
          label="최근 상담"
          value={
            client.consultations[0] ? formatDate(client.consultations[0].consultedAt) : '기록 없음'
          }
          sub={client.consultations[0]?.title ?? '상담 기록을 남겨보세요'}
        />
      </div>

      <div className="mb-5">
        <Tabs basePath={`/clients/${client.id}`} query={{}} active={tab} tabs={tabs} />
      </div>

      {tab === 'overview' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
          <Card>
            <CardHeader title="기본 정보" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <InfoItem icon={Receipt} label="사업자등록번호" value={client.businessNo} />
              <InfoItem icon={UserRound} label="대표자" value={client.ceoName} />
              <InfoItem icon={Building2} label="업종" value={client.industry} />
              <InfoItem icon={Phone} label="대표 전화" value={client.phone} />
              <InfoItem icon={Mail} label="대표 이메일" value={client.email} />
              <InfoItem
                icon={Globe}
                label="홈페이지"
                value={client.website}
                href={client.website ?? undefined}
              />
              <InfoItem icon={MapPin} label="주소" value={client.address} className="sm:col-span-2" />

              {client.memo && (
                <div className="sm:col-span-2">
                  <p className="mb-1 text-[11px] font-medium text-ink-faint">비고</p>
                  <p className="rounded-lg bg-surface-muted px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
                    {client.memo}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader title="담당 영업" />
              <CardBody>
                {client.owner ? (
                  <UserChip
                    name={client.owner.name}
                    color={client.owner.avatarColor}
                    sub={client.owner.position}
                    size="md"
                  />
                ) : (
                  <p className="text-sm text-ink-faint">담당자가 지정되지 않았습니다.</p>
                )}
                <p className="mt-3 border-t border-line pt-3 text-xs text-ink-faint">
                  {formatDate(client.createdAt)} 등록 · {formatDate(client.updatedAt)} 최근 수정
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="주 담당자" />
              <CardBody>
                {(() => {
                  const primary = client.contacts.find((contact) => contact.isPrimary) ?? client.contacts[0];
                  if (!primary) return <p className="text-sm text-ink-faint">등록된 담당자가 없습니다.</p>;

                  return (
                    <div className="space-y-1.5">
                      <p className="text-sm font-bold text-ink">{primary.name}</p>
                      <p className="text-xs text-ink-faint">
                        {[primary.department, primary.position].filter(Boolean).join(' · ') || '-'}
                      </p>
                      {primary.mobile && <p className="text-xs text-ink-soft">{primary.mobile}</p>}
                      {primary.email && <p className="text-xs text-ink-soft">{primary.email}</p>}
                    </div>
                  );
                })()}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === 'contacts' && (
        <Card>
          <CardHeader
            title="거래처 담당자"
            description="의사결정 라인을 기록해두면 담당 영업이 바뀌어도 인수인계가 쉬워집니다."
          />
          <CardBody>
            <ContactManager
              clientId={client.id}
              editable={canManageContacts}
              contacts={client.contacts.map((contact) => ({
                id: contact.id,
                name: contact.name,
                department: contact.department,
                position: contact.position,
                phone: contact.phone,
                mobile: contact.mobile,
                email: contact.email,
                isPrimary: contact.isPrimary,
                memo: contact.memo,
              }))}
            />
          </CardBody>
        </Card>
      )}

      {tab === 'consultations' && canReadConsultations && (
        <Card>
          <CardHeader title="상담 기록" description="최근 30건" />
          <CardBody>
            <ConsultationPanel
              clientId={client.id}
              canCreate={canCreateConsultations}
              currentUserId={user.id}
              canModerate={canUpdate}
              contacts={client.contacts.map((contact) => ({ id: contact.id, name: contact.name }))}
              deals={client.deals.map((deal) => ({
                id: deal.id,
                code: deal.code,
                title: deal.title,
              }))}
              consultations={client.consultations.map((row) => ({
                id: row.id,
                type: row.type,
                title: row.title,
                content: row.content,
                result: row.result,
                consultedAt: row.consultedAt.toISOString(),
                nextAction: row.nextAction,
                nextActionAt: row.nextActionAt?.toISOString() ?? null,
                authorId: row.userId,
                authorName: row.user.name,
                authorColor: row.user.avatarColor,
                contactName: row.contact?.name ?? null,
                deal: row.deal,
              }))}
            />
          </CardBody>
        </Card>
      )}

      {tab === 'deals' && canReadDeals && (
        <Card>
          <CardHeader
            title="영업건"
            description="이 거래처와 진행한 모든 영업 기회"
            moreHref="/sales"
            action={
              dealOptions && (
                <DealCreateButton
                  options={dealOptions}
                  canAssignOwner={permissions.has('deal:read:all')}
                  fixedClientId={client.id}
                  label="영업건 등록"
                  size="sm"
                />
              )
            }
          />
          {client.deals.length === 0 ? (
            <EmptyState title="등록된 영업건이 없습니다." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-faint">
                    <th className="px-5 py-3 font-medium">영업건</th>
                    <th className="px-3 py-3 font-medium">단계</th>
                    <th className="px-3 py-3 font-medium">계약</th>
                    <th className="px-3 py-3 font-medium text-right">금액</th>
                    <th className="px-3 py-3 font-medium">담당</th>
                    <th className="px-5 py-3 font-medium">종료일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {client.deals.map((deal) => (
                    <tr key={deal.id} className="transition-colors hover:bg-surface-muted">
                      <td className="max-w-xs px-5 py-3">
                        <Link href={`/sales/${deal.id}`} className="group block">
                          <span className="block font-mono text-[11px] text-ink-faint">
                            {deal.code}
                          </span>
                          <span className="block truncate font-medium text-ink group-hover:text-brand">
                            {deal.title}
                          </span>
                          {deal.contact && (
                            <span className="block text-xs text-ink-faint">{deal.contact.name}</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <DealStageBadge value={deal.stage} />
                        {deal.stage === 'LOST' && deal.lostReason && (
                          <p className="mt-0.5 text-[11px] text-ink-faint">{deal.lostReason}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <ContractStatusBadge value={deal.contractStatus} />
                      </td>
                      <td className="px-3 py-3 text-right font-medium whitespace-nowrap text-ink">
                        {formatCurrency(deal.amount)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2">
                          <Avatar name={deal.owner.name} color={deal.owner.avatarColor} size="xs" />
                          <span className="text-xs text-ink">{deal.owner.name}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs whitespace-nowrap text-ink-soft">
                        {deal.closedAt
                          ? formatDate(deal.closedAt)
                          : `예상 ${formatDate(deal.expectedCloseDate)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'tasks' && (
        <Card>
          <CardHeader
            title="관련 업무"
            description="이 거래처와 연결된 최근 업무"
            moreHref={`/tasks?client=${client.id}`}
          />
          {client.tasks.length === 0 ? (
            <EmptyState title="연결된 업무가 없습니다." />
          ) : (
            <ul className="divide-y divide-line">
              {client.tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-ink-faint">{task.code}</span>
                        <TaskStatusBadge value={task.status} />
                        <TaskPriorityBadge value={task.priority} />
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-ink">{task.title}</p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-faint">{formatDate(task.dueDate)}</span>
                    {task.assignee && (
                      <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size="xs" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card px-4 py-4">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className="mt-1.5 text-lg font-bold text-ink">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-ink-faint">{sub}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
  href,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  href?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-faint">
        <Icon className="size-3.5" />
        {label}
      </p>
      {href && value ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 block truncate text-sm font-medium text-brand hover:text-brand-dark"
        >
          {value}
        </a>
      ) : (
        <p className="mt-0.5 text-sm text-ink">{value || '-'}</p>
      )}
    </div>
  );
}
