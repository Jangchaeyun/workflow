import 'server-only';

import { addDays, endOfDay, startOfDay } from 'date-fns';

import { prisma } from '@/lib/db';
import { notify } from '@/lib/notifications';

/**
 * 마감이 임박·초과된 업무에 대해 TASK_DUE 알림을 만든다.
 * 같은 업무에 대해 최근 20시간 내 동일 타입 알림이 있으면 중복 발송하지 않는다.
 * cron 없이도 오늘 할 일 화면 진입 시 호출할 수 있다.
 */
export async function scanDueTaskReminders(): Promise<{ created: number; scanned: number }> {
  const now = new Date();
  const windowEnd = endOfDay(addDays(now, 2));
  const dedupeSince = new Date(now.getTime() - 20 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ['DONE', 'HOLD'] },
      dueDate: { not: null, lte: windowEnd },
      assigneeId: { not: null },
    },
    select: {
      id: true,
      code: true,
      title: true,
      dueDate: true,
      assigneeId: true,
    },
    take: 200,
  });

  let created = 0;

  for (const task of tasks) {
    if (!task.assigneeId || !task.dueDate) continue;

    const existing = await prisma.notification.findFirst({
      where: {
        userId: task.assigneeId,
        type: 'TASK_DUE',
        link: `/tasks/${task.id}`,
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    });
    if (existing) continue;

    const overdue = task.dueDate < startOfDay(now);
    await notify({
      userId: task.assigneeId,
      type: 'TASK_DUE',
      title: overdue ? '마감 초과 업무' : '마감 임박 업무',
      message: overdue
        ? `「${task.title}」(${task.code}) 마감일이 지났습니다.`
        : `「${task.title}」(${task.code}) 마감이 다가옵니다.`,
      link: `/tasks/${task.id}`,
    });
    created += 1;
  }

  return { created, scanned: tasks.length };
}
