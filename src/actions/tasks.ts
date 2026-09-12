'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/db';
import { assertPermission, getCurrentUser } from '@/lib/auth';
import { getAccessScope, canEditTask, canViewTask } from '@/lib/scope';
import { diff, logActivity } from '@/lib/activity';
import { notifyMany } from '@/lib/notifications';
import { nextTaskCode, withCodeRetry } from '@/lib/sequence';
import { MAX_UPLOAD_BYTES, removeUpload, saveUpload, validateUpload } from '@/lib/storage';
import { formToObject, toActionError, type ActionState } from '@/lib/form';
import {
  commentSchema,
  firstIssueMessage,
  taskCreateSchema,
  taskStatusSchema,
  taskUpdateSchema,
} from '@/lib/validators';
import { TASK_STATUS_LABEL, type TaskStatus } from '@/lib/constants';

function revalidateTaskViews(taskId?: string) {
  revalidatePath('/tasks');
  revalidatePath('/tasks/board');
  revalidatePath('/dashboard');
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await assertPermission('task:create');
    const parsed = taskCreateSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const input = parsed.data;

    // 담당자 지정 권한이 없으면 본인 업무로만 등록할 수 있다.
    const permissions = (await getAccessScope()).permissions;
    const assigneeId = permissions.has('task:assign') ? (input.assigneeId ?? null) : user.id;

    const task = await withCodeRetry(
      (code) =>
        prisma.task.create({
          data: {
            code,
            title: input.title,
            description: input.description ?? null,
            status: input.status,
            priority: input.priority,
            category: input.category,
            assigneeId,
            reporterId: user.id,
            clientId: input.clientId ?? null,
            dealId: input.dealId ?? null,
            startDate: input.startDate ?? null,
            dueDate: input.dueDate ?? null,
            estimatedHours: input.estimatedHours ?? null,
          },
        }),
      nextTaskCode,
    );

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Task',
      entityId: task.id,
      summary: `업무 등록: ${task.code} ${task.title}`,
      detail: { status: task.status, priority: task.priority, assigneeId },
    });

    await notifyMany([assigneeId], user.id, {
      type: 'TASK_ASSIGNED',
      title: '새 업무가 배정되었습니다',
      message: `${task.title} (${task.code})`,
      link: `/tasks/${task.id}`,
    });

    revalidateTaskViews();
    return { success: `업무가 등록되었습니다. (${task.code})` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: '로그인이 필요합니다.' };

    const parsed = taskUpdateSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const input = parsed.data;
    const scope = await getAccessScope();

    const before = await prisma.task.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!before) return { error: '업무를 찾을 수 없습니다.' };
    if (!canEditTask(scope, before)) return { error: '이 업무를 수정할 권한이 없습니다.' };

    const assigneeId = scope.permissions.has('task:assign')
      ? (input.assigneeId ?? null)
      : before.assigneeId;

    // 완료로 바뀌는 순간에만 완료 시각을 찍고, 되돌리면 비운다.
    const completedAt =
      input.status === 'DONE' ? (before.completedAt ?? new Date()) : null;

    const data = {
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      category: input.category,
      progress: input.status === 'DONE' ? 100 : input.progress,
      assigneeId,
      clientId: input.clientId ?? null,
      dealId: input.dealId ?? null,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      estimatedHours: input.estimatedHours ?? null,
      actualHours: input.actualHours ?? null,
      completedAt,
    };

    await prisma.task.update({ where: { id: input.id }, data });

    const changes = diff(before as unknown as Record<string, unknown>, data);
    await logActivity({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Task',
      entityId: input.id,
      summary: `업무 수정: ${before.code} ${input.title}`,
      detail: changes,
    });

    if (assigneeId && assigneeId !== before.assigneeId) {
      await notifyMany([assigneeId], user.id, {
        type: 'TASK_ASSIGNED',
        title: '담당 업무로 지정되었습니다',
        message: `${input.title} (${before.code})`,
        link: `/tasks/${input.id}`,
      });
    }

    revalidateTaskViews(input.id);
    return { success: '업무가 수정되었습니다.' };
  } catch (error) {
    return toActionError(error);
  }
}

/** 칸반 드래그 · 상세 화면 상태 버튼에서 공용으로 쓰는 상태 변경 */
export async function changeTaskStatusAction(taskId: string, status: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const parsed = taskStatusSchema.safeParse({ id: taskId, status });
  if (!parsed.success) throw new Error(firstIssueMessage(parsed.error));

  const scope = await getAccessScope();
  const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
  if (!task) throw new Error('업무를 찾을 수 없습니다.');
  if (!canEditTask(scope, task)) throw new Error('이 업무를 수정할 권한이 없습니다.');
  if (task.status === parsed.data.status) return;

  const nextStatus = parsed.data.status;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: nextStatus,
      progress: nextStatus === 'DONE' ? 100 : task.progress,
      completedAt: nextStatus === 'DONE' ? (task.completedAt ?? new Date()) : null,
    },
  });

  await logActivity({
    userId: user.id,
    action: 'STATUS_CHANGE',
    entityType: 'Task',
    entityId: taskId,
    summary: `업무 상태 변경: ${task.code} ${TASK_STATUS_LABEL[task.status as TaskStatus]} → ${TASK_STATUS_LABEL[nextStatus]}`,
    detail: { before: task.status, after: nextStatus },
  });

  // 담당자·요청자 중 본인이 아닌 사람에게 알린다.
  await notifyMany([task.assigneeId, task.reporterId], user.id, {
    type: 'TASK_ASSIGNED',
    title: '업무 상태가 변경되었습니다',
    message: `${task.title} → ${TASK_STATUS_LABEL[nextStatus]}`,
    link: `/tasks/${taskId}`,
  });

  revalidateTaskViews(taskId);
}

export async function deleteTaskAction(taskId: string): Promise<void> {
  const user = await assertPermission('task:delete');

  const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
  if (!task) throw new Error('업무를 찾을 수 없습니다.');

  // 감사 추적을 위해 실제 삭제 대신 소프트 삭제로 남긴다.
  await prisma.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });

  await logActivity({
    userId: user.id,
    action: 'DELETE',
    entityType: 'Task',
    entityId: taskId,
    summary: `업무 삭제: ${task.code} ${task.title}`,
  });

  revalidateTaskViews(taskId);
}

export async function addCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: '로그인이 필요합니다.' };

    const parsed = commentSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const scope = await getAccessScope();
    const task = await prisma.task.findFirst({
      where: { id: parsed.data.taskId, deletedAt: null },
      include: { watchers: { select: { userId: true } } },
    });
    if (!task) return { error: '업무를 찾을 수 없습니다.' };
    if (!canViewTask(scope, task)) return { error: '이 업무에 접근할 권한이 없습니다.' };

    await prisma.taskComment.create({
      data: { taskId: task.id, userId: user.id, content: parsed.data.content },
    });

    await notifyMany(
      [task.assigneeId, task.reporterId, ...task.watchers.map((watcher) => watcher.userId)],
      user.id,
      {
        type: 'TASK_COMMENT',
        title: '새 댓글이 등록되었습니다',
        message: `${task.title}: ${parsed.data.content.slice(0, 40)}`,
        link: `/tasks/${task.id}`,
      },
    );

    revalidatePath(`/tasks/${task.id}`);
    return { success: '댓글이 등록되었습니다.' };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteCommentAction(commentId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const comment = await prisma.taskComment.findFirst({
    where: { id: commentId, deletedAt: null },
  });
  if (!comment) throw new Error('댓글을 찾을 수 없습니다.');

  const scope = await getAccessScope();
  // 본인 댓글이거나 전체 수정 권한이 있을 때만 삭제할 수 있다.
  if (comment.userId !== user.id && !scope.permissions.has('task:update:all')) {
    throw new Error('댓글을 삭제할 권한이 없습니다.');
  }

  await prisma.taskComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  revalidatePath(`/tasks/${comment.taskId}`);
}

export async function uploadAttachmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: '로그인이 필요합니다.' };

    const taskId = String(formData.get('taskId') ?? '');
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);

    if (!taskId) return { error: '업무 정보가 없습니다.' };
    if (files.length === 0 || files.every((file) => file.size === 0)) {
      return { error: '업로드할 파일을 선택해주세요.' };
    }

    const scope = await getAccessScope();
    const task = await prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!task) return { error: '업무를 찾을 수 없습니다.' };
    if (!canEditTask(scope, task)) return { error: '이 업무에 파일을 첨부할 권한이 없습니다.' };

    // 한 건이라도 규칙을 위반하면 아무것도 저장하지 않고 되돌린다.
    for (const file of files) {
      const message = validateUpload(file);
      if (message) return { error: `${file.name}: ${message}` };
    }

    const saved = [];
    for (const file of files) {
      saved.push(await saveUpload(file));
    }

    await prisma.attachment.createMany({
      data: saved.map((file) => ({ ...file, taskId, uploadedById: user.id })),
    });

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Attachment',
      entityId: taskId,
      summary: `파일 첨부: ${task.code} (${saved.map((file) => file.fileName).join(', ')})`,
    });

    revalidatePath(`/tasks/${taskId}`);
    return { success: `${saved.length}개 파일을 첨부했습니다.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteAttachmentAction(attachmentId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { task: true },
  });
  if (!attachment) throw new Error('첨부파일을 찾을 수 없습니다.');

  const scope = await getAccessScope();
  if (!canEditTask(scope, attachment.task)) throw new Error('삭제할 권한이 없습니다.');

  await prisma.attachment.delete({ where: { id: attachmentId } });
  await removeUpload(attachment.storedName);

  await logActivity({
    userId: user.id,
    action: 'DELETE',
    entityType: 'Attachment',
    entityId: attachment.taskId,
    summary: `첨부파일 삭제: ${attachment.fileName}`,
  });

  revalidatePath(`/tasks/${attachment.taskId}`);
}

/** 내가 관심 있는 업무를 구독해 댓글·상태 변경 알림을 받는다. */
export async function toggleWatchAction(taskId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const existing = await prisma.taskWatcher.findUnique({
    where: { taskId_userId: { taskId, userId: user.id } },
  });

  if (existing) {
    await prisma.taskWatcher.delete({ where: { id: existing.id } });
  } else {
    const scope = await getAccessScope();
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: { watchers: { select: { userId: true } } },
    });
    if (!task) throw new Error('업무를 찾을 수 없습니다.');
    if (!canViewTask(scope, task)) throw new Error('이 업무에 접근할 권한이 없습니다.');

    await prisma.taskWatcher.create({ data: { taskId, userId: user.id } });
  }

  revalidatePath(`/tasks/${taskId}`);
}

export const MAX_ATTACHMENT_BYTES = MAX_UPLOAD_BYTES;
