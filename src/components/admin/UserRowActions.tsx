'use client';

import { useState, useTransition } from 'react';
import { Ban, Check, Loader2, RotateCcw, Trash2, UserMinus } from 'lucide-react';

import { changeUserStatusAction, deleteUserAction } from '@/actions/admin';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface UserRowActionsProps {
  userId: string;
  userName: string;
  status: string;
  canApprove: boolean;
  canDelete: boolean;
  /** 본인 계정에는 위험한 조작 버튼을 노출하지 않는다. */
  isSelf: boolean;
  openTaskCount: number;
  dealCount: number;
}

export function UserRowActions({
  userId,
  userName,
  status,
  canApprove,
  canDelete,
  isSelf,
  openTaskCount,
  dealCount,
}: UserRowActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const change = (next: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await changeUserStatusAction(userId, next);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '상태 변경에 실패했습니다.');
      }
    });
  };

  const remove = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteUserAction(userId);
        setConfirmDelete(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '삭제에 실패했습니다.');
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        {pending && <Loader2 className="size-3.5 animate-spin text-ink-faint" />}

        {canApprove && !isSelf && (
          <>
            {status === 'PENDING' && (
              <ActionChip tone="positive" onClick={() => change('ACTIVE')} disabled={pending}>
                <Check className="size-3.5" />
                승인
              </ActionChip>
            )}
            {status === 'ACTIVE' && (
              <ActionChip tone="caution" onClick={() => change('SUSPENDED')} disabled={pending}>
                <Ban className="size-3.5" />
                정지
              </ActionChip>
            )}
            {(status === 'SUSPENDED' || status === 'RESIGNED') && (
              <ActionChip tone="neutral" onClick={() => change('ACTIVE')} disabled={pending}>
                <RotateCcw className="size-3.5" />
                복구
              </ActionChip>
            )}
            {status === 'ACTIVE' && (
              <ActionChip tone="neutral" onClick={() => change('RESIGNED')} disabled={pending}>
                <UserMinus className="size-3.5" />
                퇴사
              </ActionChip>
            )}
          </>
        )}

        {canDelete && !isSelf && (
          <ActionChip tone="danger" onClick={() => setConfirmDelete(true)} disabled={pending}>
            <Trash2 className="size-3.5" />
            삭제
          </ActionChip>
        )}

        {isSelf && <span className="text-[11px] text-ink-faint">본인 계정</span>}
      </div>

      {error && <p className="max-w-56 text-right text-[11px] font-medium text-danger">{error}</p>}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="직원 계정을 삭제할까요?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={pending}>
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
            <strong className="text-ink">{userName}</strong> 계정을 삭제합니다.
          </p>
          {(openTaskCount > 0 || dealCount > 0) && (
            <p className="rounded-lg bg-caution-soft px-3 py-2 text-xs text-caution">
              진행 중 업무 {openTaskCount}건 · 담당 영업건 {dealCount}건이 연결되어 있습니다. 진행
              중인 건이 남아 있으면 삭제가 거부되므로 담당자를 먼저 변경해주세요.
            </p>
          )}
          <p className="text-xs text-ink-faint">
            감사 추적을 위해 계정은 삭제 상태로 보관되며 작성한 업무·상담 기록은 남습니다.
          </p>
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}

function ActionChip({
  tone,
  onClick,
  disabled,
  children,
}: {
  tone: 'neutral' | 'positive' | 'caution' | 'danger';
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50',
        tone === 'positive' && 'text-positive hover:bg-positive-soft',
        tone === 'caution' && 'text-caution hover:bg-caution-soft',
        tone === 'danger' && 'text-danger hover:bg-danger-soft',
        tone === 'neutral' && 'text-ink-soft hover:bg-surface-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}
