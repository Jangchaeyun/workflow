'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { formToObject, toActionError, type ActionState } from '@/lib/form';

const profileSchema = z.object({
  name: z.string().trim().min(2, '이름을 입력해주세요.').max(30),
  phone: z
    .string()
    .trim()
    .max(20)
    .transform((value) => (value === '' ? null : value))
    .nullable(),
  position: z
    .string()
    .trim()
    .max(40)
    .transform((value) => (value === '' ? null : value))
    .nullable(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요.'),
    newPassword: z.string().min(8, '새 비밀번호는 8자 이상이어야 합니다.').max(72),
    confirmPassword: z.string().min(1, '비밀번호 확인을 입력해주세요.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '새 비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword'],
  });

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const parsed = profileSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        position: parsed.data.position,
      },
    });

    await logActivity({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user.id,
      summary: '내 프로필을 수정했습니다.',
    });

    revalidatePath('/', 'layout');
    revalidatePath('/settings/profile');
    return { success: '프로필이 저장되었습니다.' };
  } catch (error) {
    return toActionError(error);
  }
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireUser();
    const parsed = passwordSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' };
    }

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    });
    if (!record) return { error: '계정을 찾을 수 없습니다.' };

    const ok = await bcrypt.compare(parsed.data.currentPassword, record.password);
    if (!ok) return { error: '현재 비밀번호가 올바르지 않습니다.' };

    const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    await logActivity({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user.id,
      summary: '비밀번호를 변경했습니다.',
    });

    revalidatePath('/settings/profile');
    return { success: '비밀번호가 변경되었습니다.' };
  } catch (error) {
    return toActionError(error);
  }
}
