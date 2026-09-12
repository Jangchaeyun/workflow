'use client';

import { useOptimistic, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertCircle, CalendarClock, GripVertical, MessageCircle } from 'lucide-react';

import { changeDealStageAction } from '@/actions/deals';
import {
  DEAL_PIPELINE_STAGES,
  DEAL_STAGE_LABEL,
  DEAL_STAGE_PROBABILITY,
  type DealStage,
} from '@/lib/constants';
import { cn, daysUntil, formatCurrencyShort, formatDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { DEAL_STAGE_COLORS } from '@/components/charts/chartTheme';

export interface PipelineDeal {
  id: string;
  code: string;
  title: string;
  amount: number;
  stage: string;
  probability: number;
  contractStatus: string;
  expectedCloseDate: string | null;
  clientName: string;
  clientGrade: string;
  ownerName: string;
  ownerColor: string;
  consultationCount: number;
  lastContactAt: string | null;
}

interface PipelineBoardProps {
  deals: PipelineDeal[];
  /** 드래그로 단계를 바꿀 수 있는 영업건 (서버에서 권한을 다시 검증한다) */
  editableIds: string[];
}

/** 실패 단계로 옮길 때는 사유를 반드시 받아 통계에서 원인 분석이 가능하게 한다. */
interface LostPrompt {
  dealId: string;
  title: string;
}

export function PipelineBoard({ deals, editableIds }: PipelineBoardProps) {
  const editable = new Set(editableIds);
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<DealStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lostPrompt, setLostPrompt] = useState<LostPrompt | null>(null);

  const [optimisticDeals, applyMove] = useOptimistic(
    deals,
    (current: PipelineDeal[], move: { id: string; stage: string }) =>
      current.map((deal) =>
        deal.id === move.id
          ? {
              ...deal,
              stage: move.stage,
              probability: DEAL_STAGE_PROBABILITY[move.stage as DealStage] ?? deal.probability,
            }
          : deal,
      ),
  );

  const commit = (dealId: string, stage: DealStage, lostReason?: string) => {
    setError(null);
    startTransition(async () => {
      applyMove({ id: dealId, stage });
      try {
        await changeDealStageAction(dealId, stage, lostReason);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '단계 변경에 실패했습니다.');
      }
    });
  };

  const move = (dealId: string, stage: DealStage) => {
    const deal = optimisticDeals.find((item) => item.id === dealId);
    if (!deal || deal.stage === stage) return;

    if (!editable.has(dealId)) {
      setError('이 영업건의 단계를 변경할 권한이 없습니다.');
      return;
    }

    if (stage === 'LOST') {
      setLostPrompt({ dealId, title: deal.title });
      return;
    }

    commit(dealId, stage);
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
        {[...DEAL_PIPELINE_STAGES, 'LOST' as DealStage].map((stage) => {
          const stageDeals = optimisticDeals.filter((deal) => deal.stage === stage);
          const stageAmount = stageDeals.reduce((sum, deal) => sum + deal.amount, 0);
          const isTarget = hoverStage === stage;

          return (
            <section
              key={stage}
              onDragOver={(event) => {
                event.preventDefault();
                setHoverStage(stage);
              }}
              onDragLeave={() => setHoverStage((current) => (current === stage ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setHoverStage(null);
                const dealId = event.dataTransfer.getData('text/plain') || dragging;
                if (dealId) move(dealId, stage);
              }}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-xl border bg-surface-muted/60 transition-colors',
                isTarget ? 'border-brand bg-brand-soft/50' : 'border-line',
              )}
            >
              <header className="space-y-1.5 px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: DEAL_STAGE_COLORS[stage] }}
                    aria-hidden
                  />
                  <h2 className="text-xs font-bold text-ink">{DEAL_STAGE_LABEL[stage]}</h2>
                  <span className="ml-auto rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">
                    {stageDeals.length}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-ink-faint">
                  {formatCurrencyShort(stageAmount)}
                  {stage !== 'WON' && stage !== 'LOST' && (
                    <span className="ml-1 text-ink-faint/70">
                      · 가중 {formatCurrencyShort(
                        Math.round((stageAmount * DEAL_STAGE_PROBABILITY[stage]) / 100),
                      )}
                    </span>
                  )}
                </p>
              </header>

              <ul className="flex-1 space-y-2 px-2 pb-2">
                {stageDeals.length === 0 && (
                  <li className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[11px] text-ink-faint">
                    카드를 여기로 끌어다 놓으세요
                  </li>
                )}

                {stageDeals.map((deal) => {
                  const canDrag = editable.has(deal.id);
                  const remaining = daysUntil(deal.expectedCloseDate);
                  const isOpen = deal.stage !== 'WON' && deal.stage !== 'LOST';
                  const late = isOpen && remaining !== null && remaining < 0;

                  return (
                    <li
                      key={deal.id}
                      draggable={canDrag}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', deal.id);
                        event.dataTransfer.effectAllowed = 'move';
                        setDragging(deal.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={cn(
                        'card px-3 py-2.5 transition-all',
                        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                        dragging === deal.id && 'scale-[0.98] opacity-40',
                      )}
                    >
                      <div className="flex items-start gap-1.5">
                        {canDrag && (
                          <GripVertical className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-ink-faint">{deal.code}</span>
                            <span className="rounded bg-surface-muted px-1 py-0.5 text-[10px] font-bold text-ink-soft">
                              {deal.clientGrade}
                            </span>
                            {isOpen && (
                              <span className="ml-auto text-[10px] font-medium text-brand">
                                {deal.probability}%
                              </span>
                            )}
                          </div>

                          <Link
                            href={`/sales/${deal.id}`}
                            className="mt-1 block text-xs leading-snug font-medium text-ink hover:text-brand"
                          >
                            {deal.title}
                          </Link>

                          <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                            {deal.clientName}
                          </p>

                          <p className="mt-1.5 text-sm font-bold text-ink">
                            {formatCurrencyShort(deal.amount)}
                          </p>

                          <div className="mt-2 flex items-center gap-2">
                            <Avatar name={deal.ownerName} color={deal.ownerColor} size="xs" />

                            <span
                              className={cn(
                                'ml-auto inline-flex items-center gap-0.5 text-[10px]',
                                late ? 'font-medium text-danger' : 'text-ink-faint',
                              )}
                            >
                              <CalendarClock className="size-3" />
                              {deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : '미정'}
                            </span>

                            {deal.consultationCount > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-faint">
                                <MessageCircle className="size-3" />
                                {deal.consultationCount}
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

      <LostReasonModal
        prompt={lostPrompt}
        onClose={() => setLostPrompt(null)}
        onConfirm={(reason) => {
          if (!lostPrompt) return;
          commit(lostPrompt.dealId, 'LOST', reason);
          setLostPrompt(null);
        }}
      />
    </div>
  );
}

function LostReasonModal({
  prompt,
  onClose,
  onConfirm,
}: {
  prompt: LostPrompt | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  if (!prompt) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="실패 사유를 남겨주세요"
      description="사유는 매출 통계의 실패 원인 분석에 집계됩니다."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 2}
            onClick={() => {
              onConfirm(reason.trim());
              setReason('');
            }}
          >
            실패 처리
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">
          <strong className="text-ink">{prompt.title}</strong> 을(를) 실패 단계로 이동합니다.
        </p>
        <Field label="실패 사유" htmlFor="lost-reason" required>
          <TextInput
            id="lost-reason"
            value={reason}
            autoFocus
            onChange={(event) => setReason(event.target.value)}
            placeholder="예: 경쟁사 단가 열위, 예산 삭감"
          />
        </Field>
      </div>
    </Modal>
  );
}
