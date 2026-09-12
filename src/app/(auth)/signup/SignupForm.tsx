'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Loader2, UserPlus } from 'lucide-react';

import { signupAction } from '@/actions/auth';
import { emptyActionState } from '@/lib/form';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Select, TextInput } from '@/components/ui/Field';

interface SignupFormProps {
  departments: { id: string; name: string }[];
}

export function SignupForm({ departments }: SignupFormProps) {
  const [state, formAction, pending] = useActionState(signupAction, emptyActionState);

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-bold text-ink">가입 신청</h1>
        <p className="text-sm text-ink-soft">
          신청 후 관리자 승인이 완료되면 로그인할 수 있습니다.
        </p>
      </header>

      {state.success ? (
        <div className="space-y-5">
          <FormMessage tone="success">{state.success}</FormMessage>
          <Link
            href="/login"
            className="block text-center text-sm font-medium text-brand hover:text-brand-dark"
          >
            로그인 화면으로 이동
          </Link>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <Field label="이름" htmlFor="name" required>
            <TextInput id="name" name="name" placeholder="홍길동" required />
          </Field>

          <Field label="이메일" htmlFor="email" required>
            <TextInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@workflow.co.kr"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="비밀번호" htmlFor="password" required hint="8자 이상">
              <TextInput id="password" name="password" type="password" autoComplete="new-password" required />
            </Field>
            <Field label="비밀번호 확인" htmlFor="passwordConfirm" required>
              <TextInput
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="부서" htmlFor="departmentId">
              <Select id="departmentId" name="departmentId" defaultValue="">
                <option value="">선택 안 함</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="직위" htmlFor="position">
              <TextInput id="position" name="position" placeholder="사원" />
            </Field>
          </div>

          <Field label="연락처" htmlFor="phone">
            <TextInput id="phone" name="phone" placeholder="010-0000-0000" />
          </Field>

          {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            {pending ? '신청 중...' : '가입 신청'}
          </Button>

          <p className="text-center text-xs text-ink-faint">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="font-medium text-brand hover:text-brand-dark">
              로그인
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
