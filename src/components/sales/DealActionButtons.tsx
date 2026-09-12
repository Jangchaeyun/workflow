'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';

import { changeDealStageAction, deleteDealAction } from '@/actions/deals';
import { DEAL_STAGES, DEAL_STAGE_LABEL, type DealStage } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput } from '@/components/ui/Field';
import { DEAL_STAGE_COLORS } from '@/components/charts/chartTheme';

/**
 * 상세 화면의 단계 전환 컨트롤.
 * 파이프라인을 좌우로 늘어놓아 지금 어디까지 왔는지와 다음 단계를 함께 보여준다.
 */
export function DealStageControl({
  dealId,
  stage,
  canEdit,
}: {
  dealId: string;
  stage: string;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState('');

  const change = (next: DealStage, lostReason?: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await changeDealStageAction(dealId, next, lostReason);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '단계 변경에 실패했습니다.');
      }
    });
  };

  const currentIndex = DEAL_STAGES.indexOf(stage as DealStage);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {DEAL_STAGES.map((value, index) => {
          const selected = value === stage;
          // 현재 단계까지는 지나온 경로로 표시해 진행 상황을 읽기 쉽게 한다.
          const passed = currentIndex >= 0 && index < currentIndex && stage !== 'LOST';

          return (
            <button
              key={value}
              type="button"
              disabled={!canEdit || pending || selected}
              onClick={() => (value === 'LOST' ? setLostOpen(true) : change(value))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                selected
                  ? 'border-transparent text-white'
                  : passed
                    ? 'border-line bg-surface-muted text-ink-soft'
                    : 'border-line bg-surface text-ink-soft',
                canEdit && !selected && 'hover:border-brand hover:text-brand',
                (!canEdit || pending) && !selected && 'cursor-not-allowed opacity-60',
              )}
              style={selected ? { backgroundColor: DEAL_STAGE_COLORS[value] } : undefined}
            >
              {!selected && (
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: DEAL_STAGE_COLORS[value] }}
                  aria-hidden
                />
              )}
              {DEAL_STAGE_LABEL[value]}
            </button>
          );
        })}
        {pending && <Loader2 className="size-4 animate-spin self-center text-ink-faint" />}
      </div>

      {!canEdit && (
        <p className="text-xs text-ink-faint">단계를 변경할 권한이 없어 조회만 가능합니다.</p>
      )}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}

      <Modal
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        title="실패 사유를 남겨주세요"
        description="사유는 매출 통계의 실패 원인 분석에 집계됩니다."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLostOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 2 || pending}
              onClick={() => {
                change('LOST', reason.trim());
                setLostOpen(false);
                setReason('');
              }}
            >
              실패 처리
            </Button>
          </>
        }
      >
        <Field label="실패 사유" htmlFor="detail-lost-reason" required>
          <TextInput
            id="detail-lost-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="예: 경쟁사 단가 열위, 예산 삭감"
          />
        </Field>
      </Modal>
    </div>
  );
}

export function DealDeleteButton({ dealId, dealTitle }: { dealId: string; dealTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteDealAction(dealId);
        router.push('/sales');
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
        title="영업건을 삭제할까요?"
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
            <strong className="text-ink">{dealTitle}</strong> 영업건을 삭제합니다.
          </p>
          <p className="text-xs text-ink-faint">
            감사 추적을 위해 데이터는 삭제 상태로 보관되며 목록과 매출 통계에서는 제외됩니다.
          </p>
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
