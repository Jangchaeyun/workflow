import type { Metadata } from 'next';
import { ListChecks } from 'lucide-react';

import { getMyPermissions, requirePermission } from '@/lib/auth';
import { getTaskBoard, getTaskFormOptions, type TaskFilters } from '@/data/tasks';
import { canEditTask } from '@/lib/scope';

import { PageHeader } from '@/components/layout/PageHeader';
import { LinkButton } from '@/components/ui/Button';
import { TaskFilterBar } from '@/components/tasks/TaskFilterBar';
import { TaskCreateButton } from '@/components/tasks/TaskFormButtons';
import { TaskBoard } from '@/components/tasks/TaskBoard';

export const metadata: Metadata = { title: '칸반 보드' };

export default async function TaskBoardPage({ searchParams }: PageProps<'/tasks/board'>) {
  await requirePermission('task:read:own');

  const raw = await searchParams;
  const filters: TaskFilters = {
    q: pick(raw.q),
    priority: pick(raw.priority),
    category: pick(raw.category),
    assignee: pick(raw.assignee),
    client: pick(raw.client),
    due: pick(raw.due),
  };

  const [permissions, options, board] = await Promise.all([
    getMyPermissions(),
    getTaskFormOptions(),
    getTaskBoard(filters),
  ]);

  // 어떤 카드를 끌 수 있는지 서버에서 미리 계산해 내려준다.
  // (실제 변경 시 서버 액션에서 같은 규칙으로 다시 검증한다.)
  const editableIds = board.items
    .filter((task) =>
      canEditTask(board.scope, {
        assigneeId: task.assignee?.id ?? null,
        reporterId: task.reporter.id,
      }),
    )
    .map((task) => task.id);

  return (
    <>
      <PageHeader
        title="칸반 보드"
        description="카드를 끌어다 놓으면 업무 상태가 즉시 변경되고 담당자에게 알림이 전송됩니다."
        action={
          <>
            <LinkButton href="/tasks" variant="secondary">
              <ListChecks className="size-4" />
              목록 보기
            </LinkButton>
            {permissions.has('task:create') && (
              <TaskCreateButton
                options={options}
                canAssign={permissions.has('task:assign')}
                defaultOpen={pick(raw.new) === '1'}
              />
            )}
          </>
        }
      />

      <TaskFilterBar
        users={options.users.map((user) => ({ id: user.id, name: user.name }))}
        clients={options.clients}
        canFilterAssignee={permissions.has('task:read:all')}
        showSort={false}
      />

      <TaskBoard
        tasks={board.items.map((task) => ({
          id: task.id,
          code: task.code,
          title: task.title,
          status: task.status,
          priority: task.priority,
          progress: task.progress,
          category: task.category,
          dueDate: task.dueDate,
          commentCount: task.commentCount,
          attachmentCount: task.attachmentCount,
          client: task.client,
          assignee: task.assignee,
        }))}
        editableIds={editableIds}
      />
    </>
  );
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}
