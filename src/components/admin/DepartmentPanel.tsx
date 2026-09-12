'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Building2, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import { deleteDepartmentAction, saveDepartmentAction } from '@/actions/admin';
import { emptyActionState } from '@/lib/form';
import { formatCurrencyShort } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, TextInput, Textarea } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RoleBadge } from '@/components/ui/StatusBadge';

export interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  costCenter: string | null;
  members: {
    id: string;
    name: string;
    role: string;
    status: string;
    position: string | null;
    avatarColor: string;
  }[];
  activeCount: number;
  wonAmountThisYear: number;
}

export function DepartmentPanel({
  departments,
  canManage,
}: {
  departments: DepartmentRow[];
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DepartmentRow | null>(null);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            부서 등록
          </Button>
        </div>
      )}

      {departments.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="등록된 부서가 없습니다."
            description="부서를 만들면 직원 소속과 부서별 실적 집계를 사용할 수 있습니다."
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {departments.map((department) => (
            <article key={department.id} className="card flex flex-col px-5 py-4">
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-ink-faint">{department.code}</span>
                    {department.costCenter && <Badge>{department.costCenter}</Badge>}
                  </div>
                  <h2 className="mt-1 truncate text-sm font-bold text-ink">{department.name}</h2>
                  {department.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-faint">
                      {department.description}
                    </p>
                  )}
                </div>

                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(department)}
                      className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
                      aria-label={`${department.name} 수정`}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <DeleteDepartmentButton
                      departmentId={department.id}
                      name={department.name}
                      memberCount={department.members.length}
                    />
                  </div>
                )}
              </header>

              <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-center">
                <div>
                  <dt className="text-[10px] text-ink-faint">소속 인원</dt>
                  <dd className="text-xs font-bold text-ink">{department.members.length}명</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-ink-faint">재직</dt>
                  <dd className="text-xs font-bold text-ink">{department.activeCount}명</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-ink-faint">올해 수주</dt>
                  <dd className="text-xs font-bold text-ink">
                    {formatCurrencyShort(department.wonAmountThisYear)}
                  </dd>
                </div>
              </dl>

              {department.members.length === 0 ? (
                <p className="mt-3 text-xs text-ink-faint">소속된 직원이 없습니다.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {department.members.slice(0, 6).map((member) => (
                    <li key={member.id} className="flex items-center gap-2">
                      <Avatar name={member.name} color={member.avatarColor} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-xs text-ink">
                        {member.name}
                        {member.position && (
                          <span className="text-ink-faint"> · {member.position}</span>
                        )}
                      </span>
                      <RoleBadge value={member.role} />
                    </li>
                  ))}
                  {department.members.length > 6 && (
                    <li className="text-[11px] text-ink-faint">
                      외 {department.members.length - 6}명
                    </li>
                  )}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}

      {creating && <DepartmentFormModal onClose={() => setCreating(false)} />}
      {editing && (
        <DepartmentFormModal initial={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function DepartmentFormModal({
  initial,
  onClose,
}: {
  initial?: DepartmentRow;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveDepartmentAction, emptyActionState);

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(onClose, 600);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? '부서 정보 수정' : '부서 등록'}
      description="부서 코드는 사원 정보와 실적 집계의 기준이 되므로 조직 규정에 맞춰 정해주세요."
      size="sm"
    >
      <form action={formAction} className="space-y-3.5">
        {initial && <input type="hidden" name="id" value={initial.id} />}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="부서명" htmlFor="department-name" required>
            <TextInput
              id="department-name"
              name="name"
              required
              maxLength={40}
              defaultValue={initial?.name ?? ''}
              placeholder="예: 영업1팀"
            />
          </Field>
          <Field label="부서 코드" htmlFor="department-code" required hint="영문 대문자로 저장됩니다.">
            <TextInput
              id="department-code"
              name="code"
              required
              maxLength={20}
              defaultValue={initial?.code ?? ''}
              placeholder="SALES1"
            />
          </Field>
        </div>

        <Field label="코스트센터" htmlFor="costCenter">
          <TextInput
            id="costCenter"
            name="costCenter"
            defaultValue={initial?.costCenter ?? ''}
            placeholder="예: CC-1010"
          />
        </Field>

        <Field label="설명" htmlFor="department-description">
          <Textarea
            id="department-description"
            name="description"
            defaultValue={initial?.description ?? ''}
            placeholder="담당 업무 범위, 관리 대상 등"
          />
        </Field>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state.success && <FormMessage tone="success">{state.success}</FormMessage>}

        <div className="flex justify-end gap-2 border-t border-line pt-3.5">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {initial ? '변경 저장' : '부서 등록'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDepartmentButton({
  departmentId,
  name,
  memberCount,
}: {
  departmentId: string;
  name: string;
  memberCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
        aria-label={`${name} 삭제`}
      >
        <Trash2 className="size-3.5" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="부서를 삭제할까요?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    await deleteDepartmentAction(departmentId);
                    setOpen(false);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : '삭제에 실패했습니다.');
                  }
                });
              }}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              삭제
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-ink-soft">
          <p>
            <strong className="text-ink">{name}</strong> 부서를 삭제합니다.
          </p>
          {memberCount > 0 && (
            <p className="rounded-lg bg-caution-soft px-3 py-2 text-xs text-caution">
              소속 직원이 {memberCount}명 있어 삭제할 수 없습니다. 직원 관리에서 소속을 먼저
              변경해주세요.
            </p>
          )}
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
