'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus } from 'lucide-react';

import { createDealAction, updateDealAction } from '@/actions/deals';
import { emptyActionState } from '@/lib/form';
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABEL,
  DEAL_STAGES,
  DEAL_STAGE_LABEL,
  DEAL_STAGE_PROBABILITY,
  type DealStage,
} from '@/lib/constants';
import { formatCurrencyShort } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Select, Textarea, TextInput } from '@/components/ui/Field';

export interface DealFormOptions {
  clients: { id: string; name: string; code: string }[];
  contacts: { id: string; clientId: string; name: string; label: string }[];
  owners: { id: string; name: string; label: string }[];
}

export interface DealFormInitial {
  id: string;
  title: string;
  clientId: string;
  contactId: string | null;
  ownerId: string;
  amount: number;
  stage: string;
  probability: number;
  contractStatus: string;
  contractStartDate: string | null;
  contractEndDate: string | null;
  expectedCloseDate: string | null;
  source: string | null;
  lostReason: string | null;
  memo: string | null;
}

interface DealFormModalProps {
  open: boolean;
  onClose: () => void;
  options: DealFormOptions;
  /** 남의 영업건을 배정할 수 있는 권한(전체 조회 권한)이 있는지 */
  canAssignOwner: boolean;
  initial?: DealFormInitial;
  /** 거래처 상세에서 열 때처럼 거래처가 이미 정해진 경우 */
  fixedClientId?: string;
}

function DealFormModal({
  open,
  onClose,
  options,
  canAssignOwner,
  initial,
  fixedClientId,
}: DealFormModalProps) {
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateDealAction : createDealAction,
    emptyActionState,
  );

  const [clientId, setClientId] = useState(initial?.clientId ?? fixedClientId ?? '');
  const [stage, setStage] = useState<DealStage>((initial?.stage as DealStage) ?? 'LEAD');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');

  // 거래처를 바꾸면 이전 거래처의 담당자가 남아 잘못 연결되는 것을 막는다.
  const clientContacts = useMemo(
    () => options.contacts.filter((contact) => contact.clientId === clientId),
    [options.contacts, clientId],
  );

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(onClose, 600);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose]);

  const parsedAmount = Number(amount.replace(/[,\s원]/g, ''));
  const probabilityHint =
    stage === 'WON' || stage === 'LOST'
      ? '종료된 단계는 확률이 자동으로 고정됩니다.'
      : `비우면 단계 기본값 ${DEAL_STAGE_PROBABILITY[stage]}% 적용`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '영업건 수정' : '영업건 등록'}
      description="단계와 금액은 파이프라인 예측 매출과 매출 통계에 바로 반영됩니다."
    >
      <form action={formAction} className="space-y-4">
        {initial && <input type="hidden" name="id" value={initial.id} />}

        <Field label="영업건 제목" htmlFor="deal-title" required>
          <TextInput
            id="deal-title"
            name="title"
            required
            maxLength={160}
            defaultValue={initial?.title ?? ''}
            placeholder="예: 2분기 생산라인 자동화 구축"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="거래처" htmlFor="clientId" required>
            <Select
              id="clientId"
              name="clientId"
              required
              value={clientId}
              disabled={Boolean(fixedClientId)}
              onChange={(event) => setClientId(event.target.value)}
            >
              <option value="">거래처 선택</option>
              {options.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.code})
                </option>
              ))}
            </Select>
            {/* disabled select 는 전송되지 않으므로 고정 거래처는 hidden 으로 함께 보낸다. */}
            {fixedClientId && <input type="hidden" name="clientId" value={fixedClientId} />}
          </Field>

          <Field
            label="거래처 담당자"
            htmlFor="contactId"
            hint={clientId ? undefined : '거래처를 먼저 선택하세요.'}
          >
            <Select
              id="contactId"
              name="contactId"
              defaultValue={initial?.contactId ?? ''}
              disabled={!clientId}
              key={clientId}
            >
              <option value="">선택 안 함</option>
              {clientContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                  {contact.label ? ` (${contact.label})` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label="예상 금액"
            htmlFor="amount"
            required
            hint={Number.isFinite(parsedAmount) && parsedAmount > 0 ? formatCurrencyShort(parsedAmount) : '원 단위'}
          >
            <TextInput
              id="amount"
              name="amount"
              required
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="30000000"
            />
          </Field>

          <Field label="영업 단계" htmlFor="stage" required>
            <Select
              id="stage"
              name="stage"
              value={stage}
              onChange={(event) => setStage(event.target.value as DealStage)}
            >
              {DEAL_STAGES.map((value) => (
                <option key={value} value={value}>
                  {DEAL_STAGE_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="수주 확률(%)" htmlFor="probability" hint={probabilityHint}>
            <TextInput
              id="probability"
              name="probability"
              inputMode="numeric"
              disabled={stage === 'WON' || stage === 'LOST'}
              defaultValue={initial ? String(initial.probability) : ''}
              placeholder={String(DEAL_STAGE_PROBABILITY[stage])}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="마감 예정일" htmlFor="expectedCloseDate">
            <TextInput
              id="expectedCloseDate"
              name="expectedCloseDate"
              type="date"
              defaultValue={initial?.expectedCloseDate ?? ''}
            />
          </Field>

          <Field
            label="담당 영업"
            htmlFor="ownerId"
            hint={canAssignOwner ? undefined : '본인이 담당자로 지정됩니다.'}
          >
            <Select
              id="ownerId"
              name="ownerId"
              defaultValue={initial?.ownerId ?? ''}
              disabled={!canAssignOwner}
            >
              <option value="">{canAssignOwner ? '선택 안 함' : '본인'}</option>
              {options.owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                  {owner.label ? ` (${owner.label})` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="space-y-3 rounded-lg border border-line px-4 py-3.5">
          <legend className="px-1 text-xs font-bold text-ink-soft">계약 관리</legend>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="계약 상태" htmlFor="contractStatus">
              <Select
                id="contractStatus"
                name="contractStatus"
                defaultValue={initial?.contractStatus ?? 'NONE'}
              >
                {CONTRACT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {CONTRACT_STATUS_LABEL[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="계약 시작일" htmlFor="contractStartDate">
              <TextInput
                id="contractStartDate"
                name="contractStartDate"
                type="date"
                defaultValue={initial?.contractStartDate ?? ''}
              />
            </Field>
            <Field label="계약 종료일" htmlFor="contractEndDate">
              <TextInput
                id="contractEndDate"
                name="contractEndDate"
                type="date"
                defaultValue={initial?.contractEndDate ?? ''}
              />
            </Field>
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="유입 경로" htmlFor="source">
            <TextInput
              id="source"
              name="source"
              defaultValue={initial?.source ?? ''}
              placeholder="예: 전시회, 기존 고객 소개"
            />
          </Field>
          {stage === 'LOST' && (
            <Field label="실패 사유" htmlFor="lostReason" hint="통계의 실패 원인 분석에 사용됩니다.">
              <TextInput
                id="lostReason"
                name="lostReason"
                defaultValue={initial?.lostReason ?? ''}
                placeholder="예: 예산 삭감, 경쟁사 단가"
              />
            </Field>
          )}
        </div>

        <Field label="메모" htmlFor="deal-memo">
          <Textarea
            id="deal-memo"
            name="memo"
            defaultValue={initial?.memo ?? ''}
            placeholder="의사결정 구조, 경쟁사 현황, 협상 포인트 등"
          />
        </Field>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state.success && <FormMessage tone="success">{state.success}</FormMessage>}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? '변경 저장' : '영업건 등록'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function DealCreateButton({
  options,
  canAssignOwner,
  fixedClientId,
  label = '영업건 등록',
  size = 'md',
}: {
  options: DealFormOptions;
  canAssignOwner: boolean;
  fixedClientId?: string;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <Plus className={size === 'sm' ? 'size-3.5' : 'size-4'} />
        {label}
      </Button>
      {/* 모달을 열 때마다 새 인스턴스를 만들어 이전 입력이 남지 않게 한다. */}
      {open && (
        <DealFormModal
          open={open}
          onClose={() => setOpen(false)}
          options={options}
          canAssignOwner={canAssignOwner}
          fixedClientId={fixedClientId}
        />
      )}
    </>
  );
}

export function DealEditButton({
  options,
  canAssignOwner,
  initial,
}: {
  options: DealFormOptions;
  canAssignOwner: boolean;
  initial: DealFormInitial;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        영업건 수정
      </Button>
      {open && (
        <DealFormModal
          open={open}
          onClose={() => setOpen(false)}
          options={options}
          canAssignOwner={canAssignOwner}
          initial={initial}
        />
      )}
    </>
  );
}