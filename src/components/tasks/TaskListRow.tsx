import Link from 'next/link';

import { Avatar } from '@/components/ui/Avatar';
import { TaskPriorityBadge, TaskStatusBadge } from '@/components/ui/StatusBadge';
import { cn, daysUntil, formatDueLabel } from '@/lib/utils';

export interface TaskRowData {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  clientName: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
}

/** 대시보드·상세 화면의 업무 요약 줄. 마감 지연은 색으로 즉시 구분한다. */
export function TaskListRow({ task, showDue = true }: { task: TaskRowData; showDue?: boolean }) {
  const remaining = daysUntil(task.dueDate);
  const late = task.status !== 'DONE' && remaining !== null && remaining < 0;
  const imminent = task.status !== 'DONE' && remaining !== null && remaining >= 0 && remaining <= 1;

  return (
    <li>
      <Link
        href={`/tasks/${task.id}`}
        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-ink-faint">{task.code}</span>
            <TaskStatusBadge value={task.status} />
            <TaskPriorityBadge value={task.priority} />
          </div>
          <p className="mt-1 truncate text-sm font-medium text-ink">{task.title}</p>
          {task.clientName && <p className="truncate text-xs text-ink-faint">{task.clientName}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {showDue && (
            <span
              className={cn(
                'hidden text-xs sm:block',
                late ? 'font-medium text-danger' : imminent ? 'font-medium text-caution' : 'text-ink-faint',
              )}
            >
              {formatDueLabel(task.dueDate)}
            </span>
          )}
          {task.assigneeName ? (
            <Avatar name={task.assigneeName} color={task.assigneeColor} size="xs" />
          ) : (
            <span className="text-[11px] text-ink-faint">미배정</span>
          )}
        </div>
      </Link>
    </li>
  );
}
