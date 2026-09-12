'use client';

import { useOptimistic, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertCircle, GripVertical, MessageSquare, Paperclip } from 'lucide-react';

import { changeTaskStatusAction } from '@/actions/tasks';
import {
  TASK_BOARD_COLUMNS,
  TASK_CATEGORY_LABEL,
  TASK_STATUS_LABEL,
  type TaskCategory,
  type TaskStatus,
} from '@/lib/constants';
import { cn, daysUntil, formatDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { TaskPriorityBadge } from '@/components/ui/StatusBadge';
import { TASK_STATUS_COLORS } from '@/components/charts/chartTheme';

export interface BoardTask {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  category: string;
  dueDate: Date | null;
  commentCount: number;
  attachmentCount: number;
  client: { id: string; name: string } | null;
  assignee: { id: string; name: string; avatarColor: string } | null;
}

interface TaskBoardProps {
  tasks: BoardTask[];
  /** 드래그로 상태를 바꿀 수 있는 업무 ID 집합 (권한 검증은 서버에서 다시 수행) */
  editableIds: string[];
}

export function TaskBoard({ tasks, editableIds }: TaskBoardProps) {
  const editable = new Set(editableIds);
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = useState<TaskStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 드롭 즉시 카드를 옮겨 보여주고, 서버 반영이 실패하면 React 가 원래 상태로 되돌린다.
  const [optimisticTasks, applyMove] = useOptimistic(
    tasks,
    (current: BoardTask[], move: { id: string; status: string }) =>
      current.map((task) => (task.id === move.id ? { ...task, status: move.status } : task)),
  );

  const move = (taskId: string, status: TaskStatus) => {
    const task = optimisticTasks.find((item) => item.id === taskId);
    if (!task || task.status === status) return;

    if (!editable.has(taskId)) {
      setError('이 업무의 상태를 변경할 권한이 없습니다.');
      return;
    }

    setError(null);
    startTransition(async () => {
      applyMove({ id: taskId, status });
      try {
        await changeTaskStatusAction(taskId, status);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '상태 변경에 실패했습니다.');
      }
    });
  };

  return (
    <div className="space-y-3">
      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger"
        >
          <AlertCircle className="size-3.5" />
          {error}
        </p>
      )}

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 lg:-mx-6 lg:px-6">
        {TASK_BOARD_COLUMNS.map((status) => {
          const columnTasks = optimisticTasks.filter((task) => task.status === status);
          const isTarget = hoverColumn === status;

          return (
            <section
              key={status}
              onDragOver={(event) => {
                event.preventDefault();
                setHoverColumn(status);
              }}
              onDragLeave={() => setHoverColumn((current) => (current === status ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setHoverColumn(null);
                const taskId = event.dataTransfer.getData('text/plain') || dragging;
                if (taskId) move(taskId, status);
              }}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-xl border bg-surface-muted/60 transition-colors',
                isTarget ? 'border-brand bg-brand-soft/50' : 'border-line',
              )}
            >
              <header className="flex items-center gap-2 px-3.5 py-3">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: TASK_STATUS_COLORS[status] }}
                  aria-hidden
                />
                <h2 className="text-xs font-bold text-ink">{TASK_STATUS_LABEL[status]}</h2>
                <span className="ml-auto rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">
                  {columnTasks.length}
                </span>
              </header>

              <ul className="flex-1 space-y-2 px-2 pb-2">
                {columnTasks.length === 0 && (
                  <li className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[11px] text-ink-faint">
                    카드를 여기로 끌어다 놓으세요
                  </li>
                )}

                {columnTasks.map((task) => {
                  const canDrag = editable.has(task.id);
                  const remaining = daysUntil(task.dueDate);
                  const late = task.status !== 'DONE' && remaining !== null && remaining < 0;

                  return (
                    <li
                      key={task.id}
                      draggable={canDrag}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', task.id);
                        event.dataTransfer.effectAllowed = 'move';
                        setDragging(task.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={cn(
                        'card px-3 py-2.5 transition-all',
                        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                        dragging === task.id && 'scale-[0.98] opacity-40',
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        {canDrag && (
                          <GripVertical className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <TaskPriorityBadge value={task.priority} />
                            <span className="truncate rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-ink-soft">
                              {TASK_CATEGORY_LABEL[task.category as TaskCategory] ?? task.category}
                            </span>
                          </div>

                          <Link
                            href={`/tasks/${task.id}`}
                            className="mt-1.5 block text-xs leading-snug font-medium text-ink hover:text-brand"
                          >
                            {task.title}
                          </Link>

                          {task.client && (
                            <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                              {task.client.name}
                            </p>
                          )}

                          <div className="mt-2 flex items-center gap-2">
                            {task.assignee ? (
                              <Avatar
                                name={task.assignee.name}
                                color={task.assignee.avatarColor}
                                size="xs"
                              />
                            ) : (
                              <span className="text-[10px] text-ink-faint">미배정</span>
                            )}

                            <span
                              className={cn(
                                'ml-auto text-[10px]',
                                late ? 'font-medium text-danger' : 'text-ink-faint',
                              )}
                            >
                              {task.dueDate ? formatDate(task.dueDate) : '기한 없음'}
                            </span>

                            {task.commentCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-faint">
                                <MessageSquare className="size-3" />
                                {task.commentCount}
                              </span>
                            )}
                            {task.attachmentCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-faint">
                                <Paperclip className="size-3" />
                                {task.attachmentCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
