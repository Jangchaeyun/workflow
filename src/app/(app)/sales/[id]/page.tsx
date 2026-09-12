import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Building2,
  CalendarClock,
  CalendarPlus,
  FileSignature,
  History,
  ListChecks,
  Mail,
  MessageCircle,
  Phone,
  Target,
  TrendingUp,
  User,
} from 'lucide-react';

import { getMyPermissions, requireAnyPermission } from '@/lib/auth';
import { getAccessScope, canEditDeal, canViewDeal } from '@/lib/scope';
import { getDealDetail, getDealFormOptions, getDealHistory } from '@/data/deals';
import {
  CONSULTATION_TYPE_LABEL,
  DEAL_STAGE_LABEL,
  LOG_ACTION_LABEL,
  type ConsultationType,
  type DealStage,
  type LogAction,
} from '@/lib/constants';
import {
  cn,
  daysUntil,
  formatCurrency,
  formatCurrencyShort,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  toDateInputValue,
} from '@/lib/utils';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar, UserChip } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Progress } from '@/components/ui/Progress';
import {
  ClientStatusBadge,
  ConsultationResultBadge,
  ContractStatusBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
} from '@/components/ui/StatusBadge';
import { DealEditButton, type DealFormInitial } from '@/components/sales/DealFormModal';
import { DealDeleteButton, DealStageControl } from '@/components/sales/DealActionButtons';

export async function generateMetadata({ params }: PageProps<'/sales/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const deal = await getDealDetail(id);
  return { title: deal ? `${deal.title}` : '영업건' };
}

export default async function DealDetailPage({ params }: PageProps<'/sales/[id]'>) {
  await requireAnyPermission('deal:read:own', 'deal:read:all');

  const { id } = await params;
  const [deal, scope, permissions] = await Promise.all([
    getDealDetail(id),
    getAccessScope(),
    getMyPermissions(),
  ]);

  if (!deal) notFound();
  // 목록 스코프와 같은 기준으로 상세 열람도 막는다.
  if (!canViewDeal(scope, deal)) notFound();

  const canEdit = canEditDeal(scope, deal);
  const canDelete = permissions.has('deal:delete');
  const [options, history] = await Promise.all([
    canEdit ? getDealFormOptions() : Promise.resolve(null),
    permissions.has('log:read') ? getDealHistory(deal.id) : Promise.resolve([]),
  ]);

  const isClosed = deal.stage === 'WON' || deal.stage === 'LOST';
  const remaining = daysUntil(deal.expectedCloseDate);
  const late = !isClosed && remaining !== null && remaining < 0;
  const weighted = Math.round((deal.amount * deal.probability) / 100);

  const initial: DealFormInitial = {
    id: deal.id,
    title: deal.title,
    clientId: deal.clientId,
    contactId: deal.contactId,
    ownerId: deal.ownerId,
    amount: deal.amount,
    stage: deal.stage,
    probability: deal.probability,
    contractStatus: deal.contractStatus,
    contractStartDate: toDateInputValue(deal.contractStartDate) || null,
    contractEndDate: toDateInputValue(deal.contractEndDate) || null,
    expectedCloseDate: toDateInputValue(deal.expectedCloseDate) || null,
    source: deal.source,
    lostReason: deal.lostReason,
    memo: deal.memo,
  };

  return (
    <>
      <PageHeader
        backHref="/sales"
        backLabel="영업 파이프라인으로"
        title={deal.title}
        meta={
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="font-mono text-xs text-ink-faint">{deal.code}</span>
            <ContractStatusBadge value={deal.contractStatus} />
            {deal.source && <Badge>유입: {deal.source}</Badge>}
            <span className="text-xs text-ink-faint">
              등록 {formatDate(deal.createdAt)}
              {deal.closedAt && ` · 종료 ${formatDate(deal.closedAt)}`}
            </span>
          </div>
        }
        action={
          <>
            {canEdit && options && (
              <DealEditButton
                options={options}
                canAssignOwner={scope.canReadAllDeals}
                initial={initial}
              />
            )}
            {canDelete && <DealDeleteButton dealId={deal.id} dealTitle={deal.title} />}
          </>
        }
      />

      {/* 금액 · 확률 · 마감 요약 */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="px-5 py-4">
          <p className="text-xs text-ink-faint">예상 금액</p>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-ink">
            {formatCurrencyShort(deal.amount)}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-faint">{formatCurrency(deal.amount)}</p>
        </Card>

        <Card className="px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs text-ink-faint">
            <TrendingUp className="size-3.5" />
            가중 예측 매출
          </p>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-brand">
            {formatCurrencyShort(weighted)}
          </p>
          <div className="mt-2">
            <Progress value={deal.probability} label="수주 확률" />
          </div>
        </Card>

        <Card className="px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs text-ink-faint">
            <CalendarClock className="size-3.5" />
            마감 예정일
          </p>
          <p
            className={cn(
              'mt-1.5 text-xl font-bold tracking-tight',
              late ? 'text-danger' : 'text-ink',
            )}
          >
            {formatDate(deal.expectedCloseDate)}
          </p>
          <p className={cn('mt-0.5 text-[11px]', late ? 'text-danger' : 'text-ink-faint')}>
            {isClosed
              ? `${DEAL_STAGE_LABEL[deal.stage as DealStage]} 처리 완료`
              : remaining === null
                ? '마감일 미정'
                : remaining < 0
                  ? `${Math.abs(remaining)}일 초과`
                  : `${remaining}일 남음`}
          </p>
        </Card>

        <Card className="px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs text-ink-faint">
            <Target className="size-3.5" />
            담당 영업
          </p>
          <div className="mt-2">
            <UserChip
              name={deal.owner.name}
              color={deal.owner.avatarColor}
              sub={deal.owner.position}
            />
          </div>
        </Card>
      </div>

      {/* 단계 전환 */}
      <Card className="mb-4">
        <CardHeader
          title="영업 단계"
          description="단계를 바꾸면 수주 확률과 예측 매출이 자동으로 갱신되고 변경 이력이 기록됩니다."
        />
        <CardBody>
          <DealStageControl dealId={deal.id} stage={deal.stage} canEdit={canEdit} />

          {deal.stage === 'LOST' && deal.lostReason && (
            <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
              실패 사유: {deal.lostReason}
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* 계약 정보 */}
          <Card>
            <CardHeader title="계약 정보" />
            <CardBody className="space-y-3">
              <dl className="grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-ink-faint">계약 상태</dt>
                  <dd className="mt-1">
                    <ContractStatusBadge value={deal.contractStatus} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">계약 시작일</dt>
                  <dd className="mt-1 text-sm text-ink">{formatDate(deal.contractStartDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-faint">계약 종료일</dt>
                  <dd className="mt-1 text-sm text-ink">{formatDate(deal.contractEndDate)}</dd>
                </div>
              </dl>

              {deal.contractStatus === 'SIGNED' && deal.contractEndDate && (
                <p className="flex items-center gap-1.5 rounded-lg bg-positive-soft px-3 py-2 text-xs text-positive">
                  <FileSignature className="size-3.5" />
                  계약 체결 완료 · 만료까지 {Math.max(0, daysUntil(deal.contractEndDate) ?? 0)}일
                </p>
              )}

              {deal.memo && (
                <div className="rounded-lg bg-surface-muted px-4 py-3">
                  <p className="text-xs font-medium text-ink-soft">메모</p>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
                    {deal.memo}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* 상담 이력 */}
          <Card>
            <CardHeader
              title="상담 이력"
              description="이 영업건에 연결된 상담 기록입니다."
              moreHref={`/clients/${deal.clientId}?tab=consultations`}
              moreLabel="거래처 상담 전체"
            />
            <CardBody>
              {deal.consultations.length === 0 ? (
                <EmptyState
                  icon={<MessageCircle className="size-5" />}
                  title="연결된 상담 기록이 없습니다."
                  description="거래처 상세에서 상담 기록을 작성할 때 이 영업건을 연결하면 여기에 모입니다."
                />
              ) : (
                <ol className="relative space-y-4 border-l border-line pl-5">
                  {deal.consultations.map((row) => (
                    <li key={row.id} className="relative">
                      <span className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full border-2 border-surface bg-brand" />
                      <div className="rounded-lg border border-line px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="info">
                            {CONSULTATION_TYPE_LABEL[row.type as ConsultationType] ?? row.type}
                          </Badge>
                          <ConsultationResultBadge value={row.result} />
                          <span className="text-xs text-ink-faint">{formatDate(row.consultedAt)}</span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-ink">{row.title}</p>
                        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
                          {row.content}
                        </p>
                        {row.nextAction && (
                          <p className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-caution-soft px-2.5 py-1.5 text-xs text-caution">
                            <CalendarPlus className="size-3.5 shrink-0" />
                            <span>
                              다음 조치: {row.nextAction}
                              {row.nextActionAt && ` (${formatDate(row.nextActionAt)})`}
                            </span>
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 text-[11px] text-ink-faint">
                          <Avatar name={row.user.name} color={row.user.avatarColor} size="xs" />
                          <span>{row.user.name}</span>
                          {row.contact && <span>· 상담 대상 {row.contact.name}</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          {/* 연결된 업무 */}
          <Card>
            <CardHeader
              title="연결된 업무"
              description="영업건 진행에 필요한 실행 업무입니다."
              moreHref={`/tasks?client=${deal.clientId}`}
              moreLabel="거래처 업무 전체"
            />
            {deal.tasks.length === 0 ? (
              <CardBody>
                <EmptyState
                  icon={<ListChecks className="size-5" />}
                  title="연결된 업무가 없습니다."
                  description="업무 등록 시 이 영업건을 연결하면 진행 상황을 함께 추적할 수 있습니다."
                />
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {deal.tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="flex flex-wrap items-center gap-2 px-5 py-3 transition-colors hover:bg-surface-muted"
                    >
                      <TaskStatusBadge value={task.status} />
                      <TaskPriorityBadge value={task.priority} />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{task.title}</span>
                      {task.assignee && (
                        <Avatar
                          name={task.assignee.name}
                          color={task.assignee.avatarColor}
                          size="xs"
                        />
                      )}
                      <span className="text-xs whitespace-nowrap text-ink-faint">
                        {formatDate(task.dueDate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* 거래처 */}
          <Card>
            <CardHeader title="거래처" moreHref={`/clients/${deal.clientId}`} moreLabel="상세 보기" />
            <CardBody className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Building2 className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{deal.client.name}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {[deal.client.code, deal.client.industry].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <ClientStatusBadge value={deal.client.status} />
                    <Badge>{deal.client.grade}등급</Badge>
                  </div>
                </div>
              </div>

              {deal.client.phone && (
                <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <Phone className="size-3.5 text-ink-faint" />
                  {deal.client.phone}
                </p>
              )}
            </CardBody>
          </Card>

          {/* 거래처 담당자 */}
          <Card>
            <CardHeader title="거래처 담당자" />
            <CardBody>
              {deal.contact ? (
                <div className="space-y-2.5">
                  <UserChip name={deal.contact.name} sub={deal.contact.position} size="md" />
                  <div className="space-y-1.5 text-xs text-ink-soft">
                    {(deal.contact.mobile || deal.contact.phone) && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="size-3.5 text-ink-faint" />
                        {deal.contact.mobile ?? deal.contact.phone}
                      </p>
                    )}
                    {deal.contact.email && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="size-3.5 text-ink-faint" />
                        {deal.contact.email}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                  <User className="size-3.5" />
                  지정된 담당자가 없습니다.
                </p>
              )}
            </CardBody>
          </Card>

          {/* 변경 이력 */}
          {history.length > 0 && (
            <Card>
              <CardHeader title="변경 이력" description="감사 로그에 기록된 이 영업건의 변경 내역" />
              <ol className="divide-y divide-line">
                {history.map((log) => (
                  <li key={log.id} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <History className="size-3.5 shrink-0 text-ink-faint" />
                      <Badge>{LOG_ACTION_LABEL[log.action as LogAction] ?? log.action}</Badge>
                      <span
                        className="ml-auto text-[11px] text-ink-faint"
                        title={formatDateTime(log.createdAt)}
                      >
                        {formatRelativeTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{log.summary}</p>
                    {log.user && (
                      <p className="mt-1 text-[11px] text-ink-faint">{log.user.name}</p>
                    )}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
