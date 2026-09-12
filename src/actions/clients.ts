'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/db';
import { assertPermission } from '@/lib/auth';
import { diff, logActivity } from '@/lib/activity';
import { nextClientCode, withCodeRetry } from '@/lib/sequence';
import { formToObject, toActionError, type ActionState } from '@/lib/form';
import {
  clientSchema,
  clientUpdateSchema,
  consultationSchema,
  contactSchema,
  firstIssueMessage,
} from '@/lib/validators';

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission('client:create');
    const parsed = clientSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const input = parsed.data;

    const client = await withCodeRetry(
      (code) =>
        prisma.client.create({
          data: {
            code,
            name: input.name,
            businessNo: input.businessNo ?? null,
            ceoName: input.ceoName ?? null,
            industry: input.industry ?? null,
            scale: input.scale,
            grade: input.grade,
            status: input.status,
            phone: input.phone ?? null,
            email: input.email ?? null,
            website: input.website ?? null,
            address: input.address ?? null,
            memo: input.memo ?? null,
            // 담당자를 지정하지 않으면 등록한 사람이 담당이 된다.
            ownerId: input.ownerId ?? user.id,
          },
        }),
      nextClientCode,
    );

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Client',
      entityId: client.id,
      summary: `거래처 등록: ${client.code} ${client.name}`,
    });

    revalidatePath('/clients');
    revalidatePath('/dashboard');
    return { success: `거래처가 등록되었습니다. (${client.code})` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission('client:update');
    const parsed = clientUpdateSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const input = parsed.data;
    const before = await prisma.client.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!before) return { error: '거래처를 찾을 수 없습니다.' };

    const data = {
      name: input.name,
      businessNo: input.businessNo ?? null,
      ceoName: input.ceoName ?? null,
      industry: input.industry ?? null,
      scale: input.scale,
      grade: input.grade,
      status: input.status,
      phone: input.phone ?? null,
      email: input.email ?? null,
      website: input.website ?? null,
      address: input.address ?? null,
      memo: input.memo ?? null,
      ownerId: input.ownerId ?? null,
    };

    await prisma.client.update({ where: { id: input.id }, data });

    await logActivity({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Client',
      entityId: input.id,
      summary: `거래처 수정: ${before.code} ${input.name}`,
      detail: diff(before as unknown as Record<string, unknown>, data),
    });

    revalidatePath('/clients');
    revalidatePath(`/clients/${input.id}`);
    return { success: '거래처 정보가 수정되었습니다.' };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteClientAction(clientId: string): Promise<void> {
  const user = await assertPermission('client:delete');

  const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
  if (!client) throw new Error('거래처를 찾을 수 없습니다.');

  // 진행 중인 영업건이 남아 있으면 실수로 지우는 것을 막는다.
  const openDeals = await prisma.deal.count({
    where: { clientId, deletedAt: null, stage: { notIn: ['WON', 'LOST'] } },
  });
  if (openDeals > 0) {
    throw new Error(`진행 중인 영업건이 ${openDeals}건 있어 삭제할 수 없습니다. 먼저 정리해주세요.`);
  }

  await prisma.client.update({ where: { id: clientId }, data: { deletedAt: new Date() } });

  await logActivity({
    userId: user.id,
    action: 'DELETE',
    entityType: 'Client',
    entityId: clientId,
    summary: `거래처 삭제: ${client.code} ${client.name}`,
  });

  revalidatePath('/clients');
}

// --- 거래처 담당자 ----------------------------------------------------------

export async function saveContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission('contact:manage');
    const parsed = contactSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const input = parsed.data;
    const contactId = String(formData.get('id') ?? '');

    const data = {
      clientId: input.clientId,
      name: input.name,
      department: input.department ?? null,
      position: input.position ?? null,
      phone: input.phone ?? null,
      mobile: input.mobile ?? null,
      email: input.email ?? null,
      isPrimary: input.isPrimary,
      memo: input.memo ?? null,
    };

    // 주 담당자는 거래처당 한 명만 유지한다.
    await prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.contact.updateMany({
          where: { clientId: input.clientId, ...(contactId ? { id: { not: contactId } } : {}) },
          data: { isPrimary: false },
        });
      }

      if (contactId) await tx.contact.update({ where: { id: contactId }, data });
      else await tx.contact.create({ data });
    });

    await logActivity({
      userId: user.id,
      action: contactId ? 'UPDATE' : 'CREATE',
      entityType: 'Contact',
      entityId: contactId || input.clientId,
      summary: `거래처 담당자 ${contactId ? '수정' : '등록'}: ${input.name}`,
    });

    revalidatePath(`/clients/${input.clientId}`);
    return { success: contactId ? '담당자 정보가 수정되었습니다.' : '담당자가 등록되었습니다.' };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteContactAction(contactId: string): Promise<void> {
  const user = await assertPermission('contact:manage');

  const contact = await prisma.contact.findFirst({ where: { id: contactId, deletedAt: null } });
  if (!contact) throw new Error('담당자를 찾을 수 없습니다.');

  await prisma.contact.update({ where: { id: contactId }, data: { deletedAt: new Date() } });

  await logActivity({
    userId: user.id,
    action: 'DELETE',
    entityType: 'Contact',
    entityId: contactId,
    summary: `거래처 담당자 삭제: ${contact.name}`,
  });

  revalidatePath(`/clients/${contact.clientId}`);
}

// --- 상담 기록 --------------------------------------------------------------

export async function createConsultationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await assertPermission('consultation:create');
    const parsed = consultationSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const input = parsed.data;

    const consultation = await prisma.consultation.create({
      data: {
        clientId: input.clientId,
        contactId: input.contactId ?? null,
        dealId: input.dealId ?? null,
        userId: user.id,
        type: input.type,
        title: input.title,
        content: input.content,
        result: input.result,
        // 상담일을 비우면 오늘 상담으로 기록한다.
        consultedAt: input.consultedAt ?? new Date(),
        nextAction: input.nextAction ?? null,
        nextActionAt: input.nextActionAt ?? null,
      },
    });

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Consultation',
      entityId: consultation.id,
      summary: `상담 기록 등록: ${input.title}`,
    });

    revalidatePath(`/clients/${input.clientId}`);
    revalidatePath('/dashboard');
    return { success: '상담 기록이 등록되었습니다.' };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteConsultationAction(consultationId: string): Promise<void> {
  const user = await assertPermission('consultation:create');

  const consultation = await prisma.consultation.findFirst({
    where: { id: consultationId, deletedAt: null },
  });
  if (!consultation) throw new Error('상담 기록을 찾을 수 없습니다.');

  // 작성자 본인이거나 거래처 수정 권한이 있어야 지울 수 있다.
  if (consultation.userId !== user.id) {
    await assertPermission('client:update');
  }

  await prisma.consultation.update({
    where: { id: consultationId },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    userId: user.id,
    action: 'DELETE',
    entityType: 'Consultation',
    entityId: consultationId,
    summary: `상담 기록 삭제: ${consultation.title}`,
  });

  revalidatePath(`/clients/${consultation.clientId}`);
}
