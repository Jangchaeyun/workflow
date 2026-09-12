'use client';

import { Fragment, useActionState, useMemo, useState, useTransition } from 'react';
import { AlertTriangle, Loader2, RotateCcw, Save, ShieldCheck } from 'lucide-react';

import { resetPermissionMatrixAction, updatePermissionMatrixAction } from '@/actions/admin';
import { emptyActionState } from '@/lib/form';
import { ROLES, ROLE_LABEL, type Role } from '@/lib/constants';
import { PERMISSION_GROUPS, DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';

interface PermissionMatrixEditorProps {
  /** `${role}:${permission}` 형태의 허용 키 */
  allowed: string[];
  memberCounts: Record<Role, number>;
}

/**
 * 역할 × 권한 매트릭스 편집기.
 *
 * 체크 상태를 클라이언트에서 관리하다가 저장 시 hidden input 으로 한 번에 보낸다.
 * 관리자(ADMIN)는 시스템에서 스스로를 잠그는 사고를 막기 위해 항상 전 권한으로 고정한다.
 */
export function PermissionMatrixEditor({ allowed, memberCounts }: PermissionMatrixEditorProps) {
  const [state, formAction, pending] = useActionState(
    updatePermissionMatrixAction,
    emptyActionState,
  );
  const [checked, setChecked] = useState<Set<string>>(() => new Set(allowed));
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, startReset] = useTransition();

  const editableRoles = useMemo(() => ROLES.filter((role) => role !== 'ADMIN'), []);

  const toggle = (key: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** 권한 하나를 모든 편집 가능 역할에 일괄 적용 (행 단위 토글) */
  const toggleRow = (permission: string) => {
    const keys = editableRoles.map((role) => `${role}:${permission}`);
    const allOn = keys.every((key) => checked.has(key));

    setChecked((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (allOn) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  };

  const changedCount = useMemo(() => {
    let count = 0;
    for (const role of editableRoles) {
      const defaults = new Set<string>(DEFAULT_ROLE_PERMISSIONS[role]);
      for (const group of PERMISSION_GROUPS) {
        for (const permission of group.permissions) {
          if (defaults.has(permission.key) !== checked.has(`${role}:${permission.key}`)) count += 1;
        }
      }
    }
    return count;
  }, [checked, editableRoles]);

  const dirty = useMemo(() => {
    const original = new Set(allowed);
    if (original.size !== checked.size) return true;
    for (const key of checked) if (!original.has(key)) return true;
    return false;
  }, [allowed, checked]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted/60">
                <th className="sticky left-0 z-10 bg-surface-muted/60 px-5 py-3 text-left text-xs font-medium text-ink-faint">
                  기능 · 권한
                </th>
                {ROLES.map((role) => (
                  <th key={role} className="px-3 py-3 text-center">
                    <p className="text-xs font-bold text-ink">{ROLE_LABEL[role]}</p>
                    <p className="mt-0.5 text-[11px] font-normal text-ink-faint">
                      {memberCounts[role] ?? 0}명
                      {role === 'ADMIN' && ' · 고정'}
                    </p>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {PERMISSION_GROUPS.map((group) => (
                <Fragment key={group.key}>
                  <tr className="bg-surface-muted/40">
                    <th
                      colSpan={ROLES.length + 1}
                      className="sticky left-0 px-5 py-2 text-left text-[11px] font-bold tracking-wide text-ink-soft"
                    >
                      {group.label}
                    </th>
                  </tr>

                  {group.permissions.map((permission) => (
                    <tr key={permission.key} className="transition-colors hover:bg-surface-muted/50">
                      <td className="sticky left-0 z-10 bg-surface px-5 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleRow(permission.key)}
                          className="group flex w-full items-center gap-2 text-left"
                          title="이 권한을 관리자 외 모든 역할에 일괄 적용/해제"
                        >
                          <span className="text-sm text-ink group-hover:text-brand">
                            {permission.label}
                          </span>
                          <span className="font-mono text-[10px] text-ink-faint">
                            {permission.key}
                          </span>
                        </button>
                      </td>

                      {ROLES.map((role) => {
                        const key = `${role}:${permission.key}`;
                        const locked = role === 'ADMIN';
                        const isChecked = locked || checked.has(key);
                        const isDefault = new Set<string>(DEFAULT_ROLE_PERMISSIONS[role]).has(
                          permission.key,
                        );

                        return (
                          <td key={role} className="px-3 py-2.5 text-center">
                            <label className="inline-flex cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={locked}
                                onChange={() => toggle(key)}
                                className={cn(
                                  'size-4 cursor-pointer rounded border-line-strong text-brand accent-brand disabled:cursor-not-allowed disabled:opacity-50',
                                )}
                                aria-label={`${ROLE_LABEL[role]} ${permission.label}`}
                              />
                              {/* 기본 정책과 다른 항목에 점을 찍어 변경분을 눈으로 찾을 수 있게 한다. */}
                              {!locked && isChecked !== isDefault && (
                                <span
                                  className="ml-1 size-1.5 rounded-full bg-caution"
                                  title="기본 정책과 다름"
                                  aria-hidden
                                />
                              )}
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 실제로 전송되는 값. 체크 상태를 한 번에 직렬화한다. */}
      {[...checked]
        .filter((key) => !key.startsWith('ADMIN:'))
        .map((key) => (
          <input key={key} type="hidden" name="permission" value={key} />
        ))}

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.success && <FormMessage tone="success">{state.success}</FormMessage>}

      <div className="card flex flex-wrap items-center gap-3 px-5 py-3.5">
        <p className="flex items-center gap-1.5 text-xs text-ink-soft">
          <ShieldCheck className="size-3.5 text-ink-faint" />
          기본 정책과 다른 항목{' '}
          <strong className={cn('font-bold', changedCount > 0 ? 'text-caution' : 'text-ink')}>
            {changedCount}건
          </strong>
        </p>

        {dirty && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-caution">
            <AlertTriangle className="size-3.5" />
            저장하지 않은 변경이 있습니다.
          </p>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setResetOpen(true)}
            disabled={pending || resetting}
          >
            <RotateCcw className="size-3.5" />
            기본값으로 초기화
          </Button>
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            권한 저장
          </Button>
        </div>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="권한을 기본값으로 되돌릴까요?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)} disabled={resetting}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={resetting}
              onClick={() =>
                startReset(async () => {
                  await resetPermissionMatrixAction();
                  setResetOpen(false);
                })
              }
            >
              {resetting && <Loader2 className="size-4 animate-spin" />}
              초기화
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          모든 역할의 권한이 시스템 기본 정책으로 덮어써집니다. 직접 조정한 내용은 사라지며 변경
          내역은 활동 로그에 기록됩니다.
        </p>
      </Modal>
    </form>
  );
}
