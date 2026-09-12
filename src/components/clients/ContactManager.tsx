'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Loader2, Mail, Pencil, Phone, Plus, Smartphone, Star, Trash2, UserRound } from 'lucide-react';

import { deleteContactAction, saveContactAction } from '@/actions/clients';
import { emptyActionState } from '@/lib/form';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Textarea, TextInput } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export interface ContactRow {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  isPrimary: boolean;
  memo: string | null;
}

interface ContactManagerProps {
  clientId: string;
  contacts: ContactRow[];
  editable: boolean;
}

export function ContactManager({ clientId, contacts, editable }: ContactManagerProps) {
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, startDelete] = useTransition();

  return (
    <div className="space-y-3">
      {contacts.length === 0 ? (
        <EmptyState
          icon={<UserRound className="size-5" />}
          title="등록된 담당자가 없습니다."
          description="거래처 측 담당자를 등록하면 상담 기록과 연결할 수 있습니다."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {contacts.map((contact) => (
            <li key={contact.id} className="rounded-lg border border-line px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-bold text-ink">{contact.name}</p>
                    {contact.isPrimary && (
                      <Badge tone="brand">
                        <Star className="size-3" />주 담당
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-ink-faint">
                    {[contact.department, contact.position].filter(Boolean).join(' · ') || '-'}
                  </p>
                </div>

                {editable && (
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditing(contact)}
                      className="rounded p-1.5 text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
                      aria-label={`${contact.name} 수정`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => startDelete(() => deleteContactAction(contact.id))}
                      className="rounded p-1.5 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      aria-label={`${contact.name} 삭제`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-1 text-xs text-ink-soft">
                {contact.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-ink-faint" />
                    {contact.phone}
                  </p>
                )}
                {contact.mobile && (
                  <p className="flex items-center gap-1.5">
                    <Smartphone className="size-3.5 text-ink-faint" />
                    {contact.mobile}
                  </p>
                )}
                {contact.email && (
                  <p className="flex items-center gap-1.5">
                    <Mail className="size-3.5 text-ink-faint" />
                    <span className="truncate">{contact.email}</span>
                  </p>
                )}
                {contact.memo && (
                  <p className="mt-2 rounded bg-surface-muted px-2 py-1.5 text-[11px] text-ink-soft">
                    {contact.memo}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" />
          담당자 추가
        </Button>
      )}

      <ContactFormModal
        clientId={clientId}
        open={creating}
        onClose={() => setCreating(false)}
      />
      <ContactFormModal
        clientId={clientId}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        initial={editing ?? undefined}
      />
    </div>
  );
}

function ContactFormModal({
  clientId,
  open,
  onClose,
  initial,
}: {
  clientId: string;
  open: boolean;
  onClose: () => void;
  initial?: ContactRow;
}) {
  const [state, formAction, pending] = useActionState(saveContactAction, emptyActionState);

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
      size="sm"
      title={initial ? '담당자 수정' : '담당자 추가'}
      description="주 담당자는 거래처당 한 명만 지정됩니다."
    >
      {/* 수정/등록 모달이 동시에 마운트되므로 key 로 초기값을 확실히 갈아준다. */}
      <form key={initial?.id ?? 'new'} action={formAction} className="space-y-3.5">
        <input type="hidden" name="clientId" value={clientId} />
        {initial && <input type="hidden" name="id" value={initial.id} />}

        <Field label="이름" htmlFor="contact-name" required>
          <TextInput id="contact-name" name="name" defaultValue={initial?.name ?? ''} required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="부서" htmlFor="contact-department">
            <TextInput
              id="contact-department"
              name="department"
              defaultValue={initial?.department ?? ''}
              placeholder="구매팀"
            />
          </Field>
          <Field label="직위" htmlFor="contact-position">
            <TextInput
              id="contact-position"
              name="position"
              defaultValue={initial?.position ?? ''}
              placeholder="과장"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="유선 전화" htmlFor="contact-phone">
            <TextInput id="contact-phone" name="phone" defaultValue={initial?.phone ?? ''} />
          </Field>
          <Field label="휴대전화" htmlFor="contact-mobile">
            <TextInput id="contact-mobile" name="mobile" defaultValue={initial?.mobile ?? ''} />
          </Field>
        </div>

        <Field label="이메일" htmlFor="contact-email">
          <TextInput id="contact-email" name="email" type="email" defaultValue={initial?.email ?? ''} />
        </Field>

        <Field label="메모" htmlFor="contact-memo">
          <Textarea
            id="contact-memo"
            name="memo"
            defaultValue={initial?.memo ?? ''}
            className="min-h-16"
            placeholder="의사결정 권한, 연락 선호 시간 등"
          />
        </Field>

        <label className="flex items-center gap-2 text-xs text-ink-soft">
          <input
            type="checkbox"
            name="isPrimary"
            defaultChecked={initial?.isPrimary ?? false}
            className="size-4 rounded border-line-strong text-brand focus:ring-brand"
          />
          주 담당자로 지정
        </label>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state.success && <FormMessage tone="success">{state.success}</FormMessage>}

        <div className="flex justify-end gap-2 border-t border-line pt-3.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
