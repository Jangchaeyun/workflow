'use client';

import { useActionState, useEffect, useRef } from 'react';
import { KeyRound, Loader2, Save, UserRound } from 'lucide-react';

import { changePasswordAction, updateProfileAction } from '@/actions/profile';
import { emptyActionState } from '@/lib/form';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, TextInput } from '@/components/ui/Field';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';

interface ProfileFormsProps {
  initial: {
    name: string;
    email: string;
    phone: string | null;
    position: string | null;
    departmentName: string | null;
    roleLabel: string;
  };
}

export function ProfileForms({ initial }: ProfileFormsProps) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileAction,
    emptyActionState,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePasswordAction,
    emptyActionState,
  );
  const passwordFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (passwordState.success) passwordFormRef.current?.reset();
  }, [passwordState.success]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="기본 정보"
          description="이름·연락처는 다른 직원에게도 표시됩니다."
        />
        <CardBody>
          <form action={profileAction} className="space-y-4">
            <Field label="이메일" htmlFor="email" hint="이메일은 관리자만 변경할 수 있습니다.">
              <TextInput id="email" value={initial.email} disabled readOnly />
            </Field>
            <Field label="이름" htmlFor="name" required>
              <TextInput
                id="name"
                name="name"
                defaultValue={initial.name}
                required
                maxLength={30}
              />
            </Field>
            <Field label="직책" htmlFor="position">
              <TextInput
                id="position"
                name="position"
                defaultValue={initial.position ?? ''}
                maxLength={40}
                placeholder="예: 대리"
              />
            </Field>
            <Field label="연락처" htmlFor="phone">
              <TextInput
                id="phone"
                name="phone"
                defaultValue={initial.phone ?? ''}
                maxLength={20}
                placeholder="010-0000-0000"
              />
            </Field>

            <div className="rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-xs text-ink-soft">
              <p>
                역할: <strong className="text-ink">{initial.roleLabel}</strong>
              </p>
              <p className="mt-1">
                부서: <strong className="text-ink">{initial.departmentName ?? '미배정'}</strong>
              </p>
            </div>

            {profileState.error && <FormMessage tone="error">{profileState.error}</FormMessage>}
            {profileState.success && (
              <FormMessage tone="success">{profileState.success}</FormMessage>
            )}

            <Button type="submit" disabled={profilePending}>
              {profilePending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              프로필 저장
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="비밀번호 변경" description="8자 이상, 주기적으로 변경하세요." />
        <CardBody>
          <form ref={passwordFormRef} action={passwordAction} className="space-y-4">
            <Field label="현재 비밀번호" htmlFor="currentPassword" required>
              <TextInput
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="새 비밀번호" htmlFor="newPassword" required>
              <TextInput
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </Field>
            <Field label="새 비밀번호 확인" htmlFor="confirmPassword" required>
              <TextInput
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
              />
            </Field>

            {passwordState.error && <FormMessage tone="error">{passwordState.error}</FormMessage>}
            {passwordState.success && (
              <FormMessage tone="success">{passwordState.success}</FormMessage>
            )}

            <Button type="submit" variant="secondary" disabled={passwordPending}>
              {passwordPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              비밀번호 변경
            </Button>
          </form>
        </CardBody>
      </Card>

      <div className="lg:col-span-2">
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-xs text-ink-soft">
          <UserRound className="mt-0.5 size-4 shrink-0 text-brand" />
          <p>
            역할·부서·사번 변경이 필요하면 관리자(직원 관리)에게 요청하세요. 이 화면에서는 본인
            연락처와 비밀번호만 수정할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
