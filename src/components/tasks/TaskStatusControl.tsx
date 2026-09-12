'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

import { changeTaskStatusAction } from '@/actions/tasks';
import { TASK_BOARD_COLUMNS, TASK_STATUS_LABEL } from '@/lib/constants';
import { TASK_STATUS_COLORS } from '@/components/charts/chartTheme';
import { cn } from '@/lib/utils';

interface TaskStatusControlProps {
  taskId: string;
  status: string;
  editable: boolean;
}

/** 상세 화면에서 한 번의 클릭으로 상태를 바꾸는 세그먼트 컨트롤 */
export function TaskStatusControl({ taskId, status, editable }: TaskStatusControlProps) {
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const change = (next: string) => {
    if (next === status || !editable) return;
    setTarget(next);
    setError(null);

    startTransition(async () => {
      try {
        await changeTaskStatusAction(taskId, next);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '상태 변경에 실패했습니다.');
      } finally {
        setTarget(null);
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {TASK_BOARD_COLUMNS.map((option) => {
          const active = option === status;
          const loading = pending && target === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => change(option)}
              disabled={!editable || pending || active}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'border-ink/10 bg-ink text-white'
                  : editable
                    ? 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink'
                    : 'cursor-not-allowed border-line bg-surface-muted text-ink-faint',
              )}
            >
              {loading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: TASK_STATUS_COLORS[option] }}
                  aria-hidden
                />
              )}
              {TASK_STATUS_LABEL[option]}
            </button>
          );
        })}
      </div>

      {!editable && (
        <p className="text-[11px] text-ink-faint">
          담당자 또는 요청자만 상태를 변경할 수 있습니다.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-[11px] font-medium text-danger">
          <AlertCircle className="size-3" />
          {error}
        </p>
      )}
    </div>
  );
}
