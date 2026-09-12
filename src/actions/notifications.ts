'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export async function markAllReadAction(): Promise<void> {
  const user = await requireUser();

  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath('/', 'layout');
}

export async function markReadAction(notificationId: string): Promise<void> {
  const user = await requireUser();

  // 남의 알림을 임의로 읽음 처리하지 못하도록 소유자 조건을 함께 건다.
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { isRead: true },
  });

  revalidatePath('/', 'layout');
}
