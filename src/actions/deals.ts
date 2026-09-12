'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/db';
import { assertPermission, getCurrentUser } from '@/lib/auth';
import { canEditDeal, getAccessScope } from '@/lib/scope';
import { diff, logActivity } from '@/lib/activity';
import { notifyMany } from '@/lib/notifications';
import { nextDealCode, withCodeRetry } from '@/lib/sequence';
import { formToObject, toActionError, type ActionState } from '@/lib/form';
import {
  dealSchema,
  dealStageSchema,
  dealUpdateSchema,
  firstIssueMessage,
  salesTargetSchema,
} from '@/lib/validators';
import { DEAL_STAGE_LABEL, DEAL_STAGE_PROBABILITY, type DealStage } from '@/lib/constants';

function revalidateSalesViews(dealId?: string, clientId?: string) {
  revalidatePath('/sales');
  revalidatePath('/sales/reports');
  revalidatePath('/dashboard');
  if (dealId) revalidatePath(`/sales/${dealId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

/**
 * 단계에 맞는 수주 확률을 결정한다.
 * 담당자가 직접 입력한 값이 있으면 존중하고, 비워두면 단계 기본값을 쓴다.
 * 수주·실패는 이미 결론이 난 상태라 100 / 0 으로 고정한다.
 */
function resolveProbability(stage: DealStage, manual: number | null | undefined): number {
  if (stage === 'WON') return 100;
  if (stage === 'LOST') return 0;
  if (manual === null || manual === undefined) return DEAL_STAGE_PROBABILITY[stage];
  return manual;
}

/** 계약 담당자가 다른 거래처 소속이면 잘못된 연결이므로 막는다. */
async function assertContactBelongsToClient(
  contactId: string | null,
  clientId: string,
): Promise<void> {
  if (!contactId) return;

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, deletedAt: null },
    select: { clientId: true },
  });

  if (!contact) throw new Error('선택한 거래처 담당자를 찾을 수 없습니다.');
  if (contact.clientId !== clientId) {
    throw new Error('거래처 담당자가 선택한 거래처 소속이 아닙니다.');
  }
}

export async function createDealAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission('deal:create');
    const parsed = dealSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const input = parsed.data;
    const scope = await getAccessScope();

    const client = await prisma.client.findFirst({
      where: { id: input.clientId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!client) return { error: '거래처를 찾을 수 없습니다.' };

    await assertContactBelongsToClient(input.contactId ?? null, client.id);

    // 남의 영업건을 대신 만들 수 있는 건 전체 조회 권한을 가진 관리자·팀장뿐이다.
    const ownerId = scope.canReadAllDeals ? (input.ownerId ?? user.id) : user.id;
    const stage = input.stage as DealStage;
    const isClosed = stage === 'WON' || stage === 'LOST';

    const deal = await withCodeRetry(
      (code) =>
        prisma.deal.create({
          data: {
            code,
            title: input.title,
            clientId: client.id,
            contactId: input.contactId ?? null,
            ownerId,
            amount: input.amount,
            stage,
            probability: resolveProbability(stage, input.probability),
            contractStatus: input.contractStatus,
            contractStartDate: input.contractStartDate ?? null,
            contractEndDate: input.contractEndDate ?? null,
            expectedCloseDate: input.expectedCloseDate ?? null,
            closedAt: isClosed ? new Date() : null,
            lostReason: stage === 'LOST' ? (input.lostReason ?? null) : null,
            source: input.source ?? null,
            memo: input.memo ?? null,
          },
        }),
      nextDealCode,
    );

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Deal',
      entityId: deal.id,
      summary: `영업건 등록: ${deal.code} ${deal.title} (${client.name})`,
      detail: { stage, amount: input.amount, ownerId },
    });

    await notifyMany([ownerId], user.id, {
      type: 'DEAL_STAGE',
      title: '새 영업건이 배정되었습니다',
      message: `${deal.title} · ${client.name}`,
      link: `/sales/${deal.id}`,
    });

    revalidateSalesViews(undefined, client.id);
    return { success: `영업건이 등록되었습니다. (${deal.code})` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateDealAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: '로그인이 필요합니다.' };

    const parsed = dealUpdateSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const input = parsed.data;
    const scope = await getAccessScope();

    const before = await prisma.deal.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!before) return { error: '영업건을 찾을 수 없습니다.' };
    if (!canEditDeal(scope, before)) return { error: '이 영업건을 수정할 권한이 없습니다.' };

    await assertContactBelongsToClient(input.contactId ?? null, input.clientId);

    const stage = input.stage as DealStage;
    const isClosed = stage === 'WON' || stage === 'LOST';
    const ownerId = scope.canReadAllDeals ? (input.ownerId ?? before.ownerId) : before.ownerId;

    const data = {
      title: input.title,
      clientId: input.clientId,
      contactId: input.contactId ?? null,
      ownerId,
      amount: input.amount,
      stage,
      probability: resolveProbability(stage, input.probability),
      contractStatus: input.contractStatus,
      contractStartDate: input.contractStartDate ?? null,
      contractEndDate: input.contractEndDate ?? null,
      expectedCloseDate: input.expectedCloseDate ?? null,
      // 종료 단계로 처음 넘어갈 때만 종료 시각을 찍고, 되돌리면 비운다.
      closedAt: isClosed ? (before.closedAt ?? new Date()) : null,
      lostReason: stage === 'LOST' ? (input.lostReason ?? null) : null,
      source: input.source ?? null,
      memo: input.memo ?? null,
    };

    await prisma.deal.update({ where: { id: input.id }, data });

    await logActivity({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Deal',
      entityId: input.id,
      summary: `영업건 수정: ${before.code} ${input.title}`,
      detail: diff(before as unknown as Record<string, unknown>, data),
    });

    if (ownerId !== before.ownerId) {
      await notifyMany([ownerId], user.id, {
        type: 'DEAL_STAGE',
        title: '영업건 담당자로 지정되었습니다',
        message: `${input.title} (${before.code})`,
        link: `/sales/${input.id}`,
      });
    }

    revalidateSalesViews(input.id, input.clientId);
    return { success: '영업건이 수정되었습니다.' };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * 파이프라인 드래그 · 상세 화면 버튼에서 공용으로 쓰는 단계 변경.
 * 단계에 따라 수주 확률과 종료 시각이 함께 갱신된다.
 */
export async function changeDealStageAction(
  dealId: string,
  stage: string,
  lostReason?: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const parsed = dealStageSchema.safeParse({ id: dealId, stage, lostReason: lostReason ?? '' });
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const scope = await getAccessScope();
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, deletedAt: null },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!deal) throw new Error('영업건을 찾을 수 없습니다.');
  if (!canEditDeal(scope, deal)) throw new Error('이 영업건을 수정할 권한이 없습니다.');

  const nextStage = parsed.data.stage;
  if (deal.stage === nextStage) return;

  const isClosed = nextStage === 'WON' || nextStage === 'LOST';

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      stage: nextStage,
      probability: resolveProbability(nextStage, null),
      closedAt: isClosed ? (deal.closedAt ?? new Date()) : null,
      lostReason: nextStage === 'LOST' ? (parsed.data.lostReason ?? deal.lostReason) : null,
      // 수주하면 계약 절차가 시작되므로 계약 상태도 함께 진행시킨다.
      contractStatus:
        nextStage === 'WON' && deal.contractStatus === 'NONE' ? 'DRAFTING' : deal.contractStatus,
    },
  });

  await logActivity({
    userId: user.id,
    action: 'STATUS_CHANGE',
    entityType: 'Deal',
    entityId: dealId,
    summary: `영업 단계 변경: ${deal.code} ${DEAL_STAGE_LABEL[deal.stage as DealStage]} → ${DEAL_STAGE_LABEL[nextStage]}`,
    detail: { before: deal.stage, after: nextStage },
  });

  await notifyMany([deal.ownerId], user.id, {
    type: 'DEAL_STAGE',
    title: '영업 단계가 변경되었습니다',
    message: `${deal.title} → ${DEAL_STAGE_LABEL[nextStage]}`,
    link: `/sales/${dealId}`,
  });

  revalidateSalesViews(dealId, deal.client.id);
}

export async function deleteDealAction(dealId: string): Promise<void> {
  const user = await assertPermission('deal:delete');

  const deal = await prisma.deal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) throw new Error('영업건을 찾을 수 없습니다.');

  await prisma.deal.update({ where: { id: dealId }, data: { deletedAt: new Date() } });

  await logActivity({
    userId: user.id,
    action: 'DELETE',
    entityType: 'Deal',
    entityId: dealId,
    summary: `영업건 삭제: ${deal.code} ${deal.title}`,
  });

  revalidateSalesViews(dealId, deal.clientId);
}

// --- 영업 목표 --------------------------------------------------------------

/**
 * 담당자 × 월 매출 목표 저장.
 * 같은 담당자·월에 두 번 저장하면 갱신되도록 upsert 한다.
 */
export async function saveSalesTargetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertPermission('report:sales');
    const parsed = salesTargetSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const { userId, year, month, targetAmount } = parsed.data;

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { error: '연도를 확인해주세요.' };
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return { error: '월을 확인해주세요.' };
    }

    const owner = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { name: true },
    });
    if (!owner) return { error: '담당자를 찾을 수 없습니다.' };

    const existing = await prisma.salesTarget.findFirst({
      where: { year, month, userId, departmentId: null },
      select: { id: true },
    });

    if (existing) {
      await prisma.salesTarget.update({ where: { id: existing.id }, data: { targetAmount } });
    } else {
      await prisma.salesTarget.create({ data: { year, month, userId, targetAmount } });
    }

    await logActivity({
      userId: user.id,
      action: existing ? 'UPDATE' : 'CREATE',
      entityType: 'SalesTarget',
      entityId: existing?.id ?? null,
      summary: `영업 목표 설정: ${owner.name} ${year}년 ${month}월 ${targetAmount.toLocaleString('ko-KR')}원`,
    });

    revalidatePath('/sales/reports');
    revalidatePath('/dashboard');
    return { success: `${owner.name}님의 ${month}월 목표를 저장했습니다.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteSalesTargetAction(
  userId: string,
  year: number,
  month: number,
): Promise<void> {
  const user = await assertPermission('report:sales');

  const target = await prisma.salesTarget.findFirst({
    where: { userId, year, month, departmentId: null },
    select: { id: true },
  });
  if (!target) return;

  await prisma.salesTarget.delete({ where: { id: target.id } });

  await logActivity({
    userId: user.id,
    action: 'DELETE',
    entityType: 'SalesTarget',
    entityId: target.id,
    summary: `영업 목표 삭제: ${year}년 ${month}월`,
  });

  revalidatePath('/sales/reports');
}
