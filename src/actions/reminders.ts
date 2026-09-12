'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth';
import { scanDueTaskReminders } from '@/lib/due-reminders';

export async function scanDueRemindersAction(): Promise<{
  error?: string;
  created?: number;
  scanned?: number;
}> {
  await requireUser();

  try {
    const result = await scanDueTaskReminders();
    revalidatePath('/', 'layout');
    revalidatePath('/today');
    return result;
  } catch {
    return { error: '마감 알림 갱신에 실패했습니다.' };
  }
}
