import 'server-only';

import { prisma } from './db';

type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_DUE'
  | 'TASK_COMMENT'
  | 'DEAL_STAGE'
  | 'USER_PENDING';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      },
    });
  } catch {
    // 알림 실패가 본 작업을 막지 않도록 무시한다.
  }
}

/** 같은 알림을 본인에게 보내지 않도록 걸러서 여러 명에게 발송 */
export async function notifyMany(
  userIds: (string | null | undefined)[],
  actorId: string,
  payload: Omit<NotifyInput, 'userId'>,
): Promise<void> {
  const targets = [...new Set(userIds.filter((id): id is string => Boolean(id) && id !== actorId))];
  await Promise.all(targets.map((userId) => notify({ ...payload, userId })));
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
