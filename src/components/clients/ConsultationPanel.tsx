'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { CalendarPlus, Loader2, MessageCircle, Plus, Trash2 } from 'lucide-react';

import { createConsultationAction, deleteConsultationAction } from '@/actions/clients';
import { emptyActionState } from '@/lib/form';
import {
  CONSULTATION_RESULTS,
  CONSULTATION_RESULT_LABEL,
  CONSULTATION_TYPES,
  CONSULTATION_TYPE_LABEL,
  type ConsultationType,
} from '@/lib/constants';
import { formatDate, toDateInputValue } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Select, Textarea, TextInput } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ConsultationResultBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';

export interface ConsultationRow {
  id: string;
  type: string;
  title: string;
  content: string;
  result: string;
  consultedAt: string;
  nextAction: string | null;
  nextActionAt: string | null;
  authorId: string;
  authorName: string;
  authorColor: string;
  contactName: string | null;
  deal: { id: string; code: string; title: string } | null;
}

interface ConsultationPanelProps {
  clientId: string;
  consultations: ConsultationRow[];
  contacts: { id: string; name: string }[];
  deals: { id: string; code: string; title: string }[];
  canCreate: boolean;
  currentUserId: string;
  canModerate: boolean;
}

export function ConsultationPanel({
  clientId,
  consultations,
  contacts,
  deals,
  canCreate,
  currentUserId,
  canModerate,
}: ConsultationPanelProps) {
  const [open, setOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  return (
    <div className="space-y-4">
      {canCreate && (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />
          상담 기록 작성
        </Button>
      )}

      {consultations.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-5" />}
          title="등록된 상담 기록이 없습니다."
          description="통화·방문·회의 내용을 남겨두면 담당자가 바뀌어도 맥락이 유지됩니다."
        />
      ) : (
        // 시간순 타임라인. 왼쪽 선으로 이력의 연속성을 시각화한다.
        <ol className="relative space-y-4 border-l border-line pl-5">
          {consultations.map((row) => (
            <li key={row.id} className="relative">
              <span className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full border-2 border-surface bg-brand" />

              <div className="rounded-lg border border-line px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">
                    {CONSULTATION_TYPE_LABEL[row.type as ConsultationType] ?? row.type}
                  </Badge>
                  <ConsultationResultBadge value={row.result} />
                  <span className="text-xs text-ink-faint">{formatDate(row.consultedAt)}</span>

                  {(row.authorId === currentUserId || canModerate) && (
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => startDelete(() => deleteConsultationAction(row.id))}
                      className="ml-auto rounded p-1 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      aria-label="상담 기록 삭제"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>

                <p className="mt-2 text-sm font-bold text-ink">{row.title}</p>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
                  {row.content}
                </p>

                {row.nextAction && (
                  <p className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-caution-soft px-2.5 py-1.5 text-xs text-caution">
                    <CalendarPlus className="size-3.5 shrink-0" />
                    <span>
                      다음 조치: {row.nextAction}
                      {row.nextActionAt && ` (${formatDate(row.nextActionAt)})`}
                    </span>
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2.5 text-[11px] text-ink-faint">
                  <Avatar name={row.authorName} color={row.authorColor} size="xs" />
                  <span>{row.authorName}</span>
                  {row.contactName && <span>· 상담 대상 {row.contactName}</span>}
                  {row.deal && (
                    <Link
                      href={`/sales/${row.deal.id}`}
                      className="ml-auto font-medium text-brand hover:text-brand-dark"
                    >
                      {row.deal.title}
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <ConsultationFormModal
        clientId={clientId}
        contacts={contacts}
        deals={deals}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

function ConsultationFormModal({
  clientId,
  contacts,
  deals,
  open,
  onClose,
}: {
  clientId: string;
  contacts: { id: string; name: string }[];
  deals: { id: string; code: string; title: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createConsultationAction, emptyActionState);

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(onClose, 600);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="상담 기록 작성"
      description="다음 조치를 함께 등록하면 대시보드의 후속 조치 목록에 나타납니다."
    >
      <form action={formAction} className="space-y-3.5">
        <input type="hidden" name="clientId" value={clientId} />

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="상담 유형" htmlFor="type" required>
            <Select id="type" name="type" defaultValue="PHONE">
              {CONSULTATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CONSULTATION_TYPE_LABEL[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="상담 결과" htmlFor="result">
            <Select id="result" name="result" defaultValue="NEUTRAL">
              {CONSULTATION_RESULTS.map((result) => (
                <option key={result} value={result}>
                  {CONSULTATION_RESULT_LABEL[result]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="상담일" htmlFor="consultedAt" hint="비우면 오늘">
            <TextInput
              id="consultedAt"
              name="consultedAt"
              type="date"
              defaultValue={toDateInputValue(new Date())}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="상담 대상" htmlFor="contactId">
            <Select id="contactId" name="contactId" defaultValue="">
              <option value="">선택 안 함</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="연결할 영업건" htmlFor="dealId">
            <Select id="dealId" name="dealId" defaultValue="">
              <option value="">선택 안 함</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.code} · {deal.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="제목" htmlFor="consultation-title" required>
          <TextInput
            id="consultation-title"
            name="title"
            required
            placeholder="예: 견적 및 단가 협의"
          />
        </Field>

        <Field label="상담 내용" htmlFor="content" required>
          <Textarea
            id="content"
            name="content"
            required
            placeholder="논의 내용, 고객 반응, 합의 사항을 구체적으로 적어주세요."
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="다음 조치" htmlFor="nextAction">
            <TextInput id="nextAction" name="nextAction" placeholder="예: 수정 견적서 발송" />
          </Field>
          <Field label="조치 예정일" htmlFor="nextActionAt">
            <TextInput id="nextActionAt" name="nextActionAt" type="date" />
          </Field>
        </div>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state.success && <FormMessage tone="success">{state.success}</FormMessage>}

        <div className="flex justify-end gap-2 border-t border-line pt-3.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            기록 저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
