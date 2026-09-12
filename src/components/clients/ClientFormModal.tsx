'use client';

import { useActionState, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus } from 'lucide-react';

import { createClientAction, updateClientAction } from '@/actions/clients';
import { emptyActionState } from '@/lib/form';
import {
  CLIENT_GRADES,
  CLIENT_SCALES,
  CLIENT_SCALE_LABEL,
  CLIENT_STATUSES,
  CLIENT_STATUS_LABEL,
} from '@/lib/constants';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Select, Textarea, TextInput } from '@/components/ui/Field';

export interface ClientFormInitial {
  id: string;
  name: string;
  businessNo: string | null;
  ceoName: string | null;
  industry: string | null;
  scale: string;
  grade: string;
  status: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  memo: string | null;
  ownerId: string | null;
}

interface ClientFormModalProps {
  open: boolean;
  onClose: () => void;
  owners: { id: string; name: string; label: string }[];
  initial?: ClientFormInitial;
}

function ClientFormModal({ open, onClose, owners, initial }: ClientFormModalProps) {
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateClientAction : createClientAction,
    emptyActionState,
  );

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
      title={isEdit ? '거래처 정보 수정' : '거래처 등록'}
      description="등급과 상태는 대시보드 통계와 영업 우선순위 판단에 사용됩니다."
    >
      <form action={formAction} className="space-y-4">
        {initial && <input type="hidden" name="id" value={initial.id} />}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="거래처명" htmlFor="name" required>
            <TextInput id="name" name="name" defaultValue={initial?.name ?? ''} required maxLength={120} />
          </Field>
          <Field label="사업자등록번호" htmlFor="businessNo">
            <TextInput
              id="businessNo"
              name="businessNo"
              defaultValue={initial?.businessNo ?? ''}
              placeholder="000-00-00000"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="대표자" htmlFor="ceoName">
            <TextInput id="ceoName" name="ceoName" defaultValue={initial?.ceoName ?? ''} />
          </Field>
          <Field label="업종" htmlFor="industry">
            <TextInput
              id="industry"
              name="industry"
              defaultValue={initial?.industry ?? ''}
              placeholder="예: 기계부품 제조"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="기업 규모" htmlFor="scale">
            <Select id="scale" name="scale" defaultValue={initial?.scale ?? 'SMALL'}>
              {CLIENT_SCALES.map((scale) => (
                <option key={scale} value={scale}>
                  {CLIENT_SCALE_LABEL[scale]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="등급" htmlFor="grade" hint="A: 핵심 거래처">
            <Select id="grade" name="grade" defaultValue={initial?.grade ?? 'C'}>
              {CLIENT_GRADES.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}등급
                </option>
              ))}
            </Select>
          </Field>
          <Field label="거래 상태" htmlFor="status">
            <Select id="status" name="status" defaultValue={initial?.status ?? 'PROSPECT'}>
              {CLIENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CLIENT_STATUS_LABEL[status]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="담당 영업" htmlFor="ownerId" hint="비워두면 등록한 사용자가 담당이 됩니다.">
          <Select id="ownerId" name="ownerId" defaultValue={initial?.ownerId ?? ''}>
            <option value="">선택 안 함</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
                {owner.label ? ` (${owner.label})` : ''}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="대표 전화" htmlFor="phone">
            <TextInput id="phone" name="phone" defaultValue={initial?.phone ?? ''} placeholder="02-000-0000" />
          </Field>
          <Field label="대표 이메일" htmlFor="email">
            <TextInput id="email" name="email" type="email" defaultValue={initial?.email ?? ''} />
          </Field>
        </div>

        <Field label="홈페이지" htmlFor="website">
          <TextInput id="website" name="website" defaultValue={initial?.website ?? ''} placeholder="https://" />
        </Field>

        <Field label="주소" htmlFor="address">
          <TextInput id="address" name="address" defaultValue={initial?.address ?? ''} />
        </Field>

        <Field label="비고" htmlFor="memo">
          <Textarea
            id="memo"
            name="memo"
            defaultValue={initial?.memo ?? ''}
            placeholder="단가 정책, 결제 조건, 주의 사항 등"
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
            {isEdit ? '변경 저장' : '거래처 등록'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ClientCreateButton({ owners }: { owners: { id: string; name: string; label: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        거래처 등록
      </Button>
      <ClientFormModal open={open} onClose={() => setOpen(false)} owners={owners} />
    </>
  );
}

export function ClientEditButton({
  owners,
  initial,
}: {
  owners: { id: string; name: string; label: string }[];
  initial: ClientFormInitial;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        정보 수정
      </Button>
      <ClientFormModal
        open={open}
        onClose={() => setOpen(false)}
        owners={owners}
        initial={initial}
      />
    </>
  );
}
