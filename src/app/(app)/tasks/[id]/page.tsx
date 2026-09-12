import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Building2, CalendarClock, Clock, Eye, TrendingUp, User } from 'lucide-react';

import { prisma } from '@/lib/db';
import { getMyPermissions, requirePermission } from '@/lib/auth';
import { getAccessScope, canEditTask, canViewTask } from '@/lib/scope';
import { getTaskDetail, getTaskFormOptions } from '@/data/tasks';
import {
  LOG_ACTION_LABEL,
  TASK_CATEGORY_LABEL,
  type LogAction,
  type TaskCategory,
} from '@/lib/constants';
import { formatDate, formatDateTime, formatDueLabel, formatRelativeTime } from '@/lib/utils';
import { formatFileSize } from '@/lib/storage';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Avatar, UserChip } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Progress, toneForProgress } from '@/components/ui/Progress';
import { DealStageBadge, TaskPriorityBadge } from '@/components/ui/StatusBadge';
import { TaskStatusControl } from '@/components/tasks/TaskStatusControl';
import { TaskComments } from '@/components/tasks/TaskComments';
import { TaskAttachments } from '@/components/tasks/TaskAttachments';
import { TaskDeleteButton, TaskWatchButton } from '@/components/tasks/TaskActionButtons';
import { TaskEditButton } from '@/components/tasks/TaskFormButtons';

export const metadata: Metadata = { title: '업무 상세' };

export default async function TaskDetailPage({ params }: PageProps<'/tasks/[id]'>) {
  const user = await requirePermission('task:read:own');
  const { id } = await params;

  const [task, scope, permissions] = await Promise.all([
    getTaskDetail(id),
    getAccessScope(),
    getMyPermissions(),
  ]);

  if (!task) notFound();

  // 목록 스코프 밖의 업무는 URL 로 직접 들어와도 열리지 않아야 한다.
  if (!canViewTask(scope, task)) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <Card className="px-6 py-10 text-center">
          <h1 className="text-lg font-bold text-ink">조회 권한이 없는 업무입니다</h1>
          <p className="mt-2 text-sm text-ink-soft">
            담당자·요청자·참조자로 지정된 업무만 열람할 수 있습니다.
          </p>
          <Link href="/tasks" className="mt-6 inline-block text-sm font-medium text-brand">
            업무 목록으로 이동
          </Link>
        </Card>
      </div>
    );
  }

  const editable = canEditTask(scope, task);
  const watching = task.watchers.some((watcher) => watcher.userId === user.id);

  const [options, logs] = await Promise.all([
    editable ? getTaskFormOptions() : Promise.resolve(null),
    prisma.activityLog.findMany({
      where: { entityType: { in: ['Task', 'Attachment'] }, entityId: task.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { user: { select: { name: true, avatarColor: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        backHref="/tasks"
        backLabel="업무 목록"
        title={task.title}
        meta={
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="font-mono text-xs text-ink-faint">{task.code}</span>
            <TaskPriorityBadge value={task.priority} />
            <Badge>{TASK_CATEGORY_LABEL[task.category as TaskCategory] ?? task.category}</Badge>
            <span className="text-xs text-ink-faint">
              {formatRelativeTime(task.createdAt)} 등록 · {task.reporter.name} 요청
            </span>
          </div>
        }
        action={
          <>
            <TaskWatchButton taskId={task.id} watching={watching} />
            {editable && options && (
              <TaskEditButton
                options={options}
                canAssign={permissions.has('task:assign')}
                initial={{
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  status: task.status,
                  priority: task.priority,
                  category: task.category,
                  progress: task.progress,
                  assigneeId: task.assigneeId,
                  clientId: task.clientId,
                  startDate: task.startDate,
                  dueDate: task.dueDate,
                  estimatedHours: task.estimatedHours,
                  actualHours: task.actualHours,
                }}
              />
            )}
            {permissions.has('task:delete') && (
              <TaskDeleteButton taskId={task.id} taskTitle={task.title} />
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="진행 상태" description="상태를 바꾸면 관련자에게 알림이 전송됩니다." />
            <CardBody className="space-y-4">
              <TaskStatusControl taskId={task.id} status={task.status} editable={editable} />
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink-soft">진행률</p>
                <Progress
                  value={task.progress}
                  size="md"
                  tone={toneForProgress(task.progress)}
                  label="업무 진행률"
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="업무 내용" />
            <CardBody>
              {task.description ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
                  {task.description}
                </p>
              ) : (
                <p className="text-sm text-ink-faint">등록된 내용이 없습니다.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="댓글"
              description={`${task.comments.length}건`}
            />
            <CardBody>
              <TaskComments
                taskId={task.id}
                currentUserId={user.id}
                canModerate={permissions.has('task:update:all')}
                comments={task.comments.map((comment) => ({
                  id: comment.id,
                  content: comment.content,
                  createdAt: comment.createdAt.toISOString(),
                  authorId: comment.user.id,
                  authorName: comment.user.name,
                  authorColor: comment.user.avatarColor,
                  authorPosition: comment.user.position,
                }))}
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="업무 정보" />
            <CardBody className="space-y-4">
              <InfoRow icon={User} label="담당자">
                {task.assignee ? (
                  <UserChip
                    name={task.assignee.name}
                    color={task.assignee.avatarColor}
                    sub={task.assignee.position}
                  />
                ) : (
                  <span className="text-sm text-ink-faint">미배정</span>
                )}
              </InfoRow>

              <InfoRow icon={User} label="요청자">
                <UserChip
                  name={task.reporter.name}
                  color={task.reporter.avatarColor}
                  sub={task.reporter.position}
                />
              </InfoRow>

              <InfoRow icon={CalendarClock} label="일정">
                <p className="text-sm text-ink">
                  {formatDate(task.startDate)} ~ {formatDate(task.dueDate)}
                </p>
                <p className="text-xs text-ink-faint">{formatDueLabel(task.dueDate)}</p>
                {task.completedAt && (
                  <p className="text-xs text-positive">{formatDateTime(task.completedAt)} 완료</p>
                )}
              </InfoRow>

              <InfoRow icon={Clock} label="공수">
                <p className="text-sm text-ink">
                  예상 {task.estimatedHours ?? '-'}h / 실제 {task.actualHours ?? '-'}h
                </p>
              </InfoRow>

              {task.client && (
                <InfoRow icon={Building2} label="거래처">
                  <Link
                    href={`/clients/${task.client.id}`}
                    className="text-sm font-medium text-brand hover:text-brand-dark"
                  >
                    {task.client.name}
                  </Link>
                </InfoRow>
              )}

              {task.deal && (
                <InfoRow icon={TrendingUp} label="연결된 영업건">
                  <Link
                    href={`/sales?deal=${task.deal.id}`}
                    className="text-sm font-medium text-brand hover:text-brand-dark"
                  >
                    {task.deal.title}
                  </Link>
                  <span className="mt-1 inline-block">
                    <DealStageBadge value={task.deal.stage} />
                  </span>
                </InfoRow>
              )}

              {task.watchers.length > 0 && (
                <InfoRow icon={Eye} label="참조자">
                  <span className="flex flex-wrap gap-1.5">
                    {task.watchers.map((watcher) => (
                      <Avatar
                        key={watcher.userId}
                        name={watcher.user.name}
                        color={watcher.user.avatarColor}
                        size="xs"
                      />
                    ))}
                  </span>
                </InfoRow>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="첨부파일" description={`${task.attachments.length}건`} />
            <CardBody>
              <TaskAttachments
                taskId={task.id}
                editable={editable}
                attachments={task.attachments.map((file) => ({
                  id: file.id,
                  fileName: file.fileName,
                  size: formatFileSize(file.size),
                  uploaderName: file.uploadedBy.name,
                  createdAt: file.createdAt.toISOString(),
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="변경 이력" description="이 업무에 기록된 활동 로그" />
            {logs.length === 0 ? (
              <CardBody>
                <p className="text-xs text-ink-faint">기록된 이력이 없습니다.</p>
              </CardBody>
            ) : (
              <ol className="divide-y divide-line">
                {logs.map((log) => (
                  <li key={log.id} className="flex gap-2.5 px-5 py-3">
                    <Avatar
                      name={log.user?.name ?? '시스템'}
                      color={log.user?.avatarColor}
                      size="xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-ink-soft">
                        <span className="font-medium text-ink">{log.user?.name ?? '시스템'}</span>{' '}
                        {LOG_ACTION_LABEL[log.action as LogAction] ?? log.action}
                      </p>
                      <p className="truncate text-[11px] text-ink-faint">{log.summary}</p>
                      <p className="text-[11px] text-ink-faint">
                        {formatRelativeTime(log.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-faint">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-ink-faint">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
