'use client';

import { useActionState, useEffect, useState } from 'react';
import { Loader2, Pencil, UserPlus } from 'lucide-react';

import { createUserAction, updateUserAction } from '@/actions/admin';
import { emptyActionState } from '@/lib/form';
import {
  ROLES,
  ROLE_LABEL,
  USER_STATUSES,
  USER_STATUS_LABEL,
  type Role,
} from '@/lib/constants';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Select, TextInput } from '@/components/ui/Field';

export interface UserFormOptions {
  departments: { id: string; name: string; code: string }[];
  managers: { id: string; name: string; position: string | null }[];
}

export interface UserFormInitial {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  employeeNo: string | null;
  position: string | null;
  phone: string | null;
  departmentId: string | null;
  hireDate: string | null;
}

/** 역할을 고를 때 어떤 범위의 권한이 붙는지 알려준다. */
const ROLE_HINT: Record<Role, string> = {
  ADMIN: '모든 기능과 권한 관리에 접근할 수 있습니다.',
  MANAGER: '조직 전체 업무·영업 현황을 조회하고 배정할 수 있습니다.',
  SALES: '거래처와 본인 영업건을 관리합니다.',
  EMPLOYEE: '본인이 담당·요청한 업무만 조회하고 처리합니다.',
};

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  options: UserFormOptions;
  initial?: UserFormInitial;
}

function UserFormModal({ open, onClose, options, initial }: UserFormModalProps) {
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateUserAction : createUserAction,
    emptyActionState,
  );
  const [role, setRole] = useState<Role>((initial?.role as Role) ?? 'EMPLOYEE');

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(onClose, 700);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '직원 정보 수정' : '직원 등록'}
      description="역할에 따라 접근 가능한 메뉴와 데이터 범위가 달라집니다."
    >
      <form action={formAction} className="space-y-4">
        {initial && <input type="hidden" name="id" value={initial.id} />}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="이름" htmlFor="user-name" required>
            <TextInput
              id="user-name"
              name="name"
              required
              maxLength={30}
              defaultValue={initial?.name ?? ''}
            />
          </Field>

          {isEdit ? (
            <Field label="이메일" htmlFor="user-email" hint="이메일은 변경할 수 없습니다.">
              <TextInput id="user-email" value={initial?.email ?? ''} disabled readOnly />
            </Field>
          ) : (
            <Field label="이메일" htmlFor="user-email" required>
              <TextInput id="user-email" name="email" type="email" required autoComplete="off" />
            </Field>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={isEdit ? '비밀번호 재설정' : '초기 비밀번호'}
            htmlFor="user-password"
            required={!isEdit}
            hint={isEdit ? '비워두면 기존 비밀번호를 유지합니다.' : '8자 이상'}
          >
            <TextInput
              id="user-password"
              name="password"
              type="password"
              required={!isEdit}
              autoComplete="new-password"
              minLength={isEdit ? undefined : 8}
              defaultValue=""
            />
          </Field>
          <Field label="사원번호" htmlFor="employeeNo" hint="비우면 자동 부여">
            <TextInput
              id="employeeNo"
              name="employeeNo"
              defaultValue={initial?.employeeNo ?? ''}
              placeholder="EMP-0001"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="역할" htmlFor="user-role" required hint={ROLE_HINT[role]}>
            <Select
              id="user-role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="계정 상태" htmlFor="user-status" required>
            <Select id="user-status" name="status" defaultValue={initial?.status ?? 'ACTIVE'}>
              {USER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {USER_STATUS_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="부서" htmlFor="departmentId">
            <Select id="departmentId" name="departmentId" defaultValue={initial?.departmentId ?? ''}>
              <option value="">미지정</option>
              {options.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="직위" htmlFor="user-position">
            <TextInput
              id="user-position"
              name="position"
              defaultValue={initial?.position ?? ''}
              placeholder="예: 과장"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="연락처" htmlFor="user-phone">
            <TextInput
              id="user-phone"
              name="phone"
              defaultValue={initial?.phone ?? ''}
              placeholder="010-0000-0000"
            />
          </Field>
          <Field label="입사일" htmlFor="hireDate">
            <TextInput
              id="hireDate"
              name="hireDate"
              type="date"
              defaultValue={initial?.hireDate ?? ''}
            />
          </Field>
        </div>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state.success && <FormMessage tone="success">{state.success}</FormMessage>}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? '변경 저장' : '직원 등록'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function UserCreateButton({ options }: { options: UserFormOptions }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        직원 등록
      </Button>
      {open && <UserFormModal open onClose={() => setOpen(false)} options={options} />}
    </>
  );
}

export function UserEditButton({
  options,
  initial,
}: {
  options: UserFormOptions;
  initial: UserFormInitial;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
      >
        <Pencil className="size-3.5" />
        수정
      </button>
      {open && (
        <UserFormModal open onClose={() => setOpen(false)} options={options} initial={initial} />
      )}
    </>
  );
}
