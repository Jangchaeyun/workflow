'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, Loader2, Trash2 } from 'lucide-react';

import { deleteTaskAction, toggleWatchAction } from '@/actions/tasks';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export function TaskWatchButton({ taskId, watching }: { taskId: string; watching: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      onClick={() => startTransition(() => toggleWatchAction(taskId))}
      disabled={pending}
      title={watching ? '알림 구독을 해제합니다' : '이 업무의 변경 알림을 받습니다'}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : watching ? (
        <BellOff className="size-3.5" />
      ) : (
        <Bell className="size-3.5" />
      )}
      {watching ? '알림 해제' : '알림 받기'}
    </Button>
  );
}

export function TaskDeleteButton({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteTaskAction(taskId);
        router.push('/tasks');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '삭제에 실패했습니다.');
      }
    });
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Trash2 className="size-3.5" />
        삭제
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="업무를 삭제할까요?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button variant="danger" onClick={remove} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              삭제
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-ink-soft">
          <p>
            <strong className="text-ink">{taskTitle}</strong> 업무를 삭제합니다.
          </p>
          <p className="text-xs text-ink-faint">
            감사 추적을 위해 데이터는 완전히 지워지지 않고 삭제 상태로 보관되며, 목록과 통계에서는
            제외됩니다.
          </p>
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
