'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Loader2, LogIn } from 'lucide-react';

import { loginAction } from '@/actions/auth';
import { emptyActionState } from '@/lib/form';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, TextInput } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

/** 데모 열람자가 역할별 화면 차이를 바로 확인할 수 있도록 준비한 계정 */
const DEMO_ACCOUNTS = [
  { label: '시스템 관리자', email: 'admin@workflow.co.kr', note: '전 기능 + 권한 관리' },
  { label: '팀장', email: 'manager.sales@workflow.co.kr', note: '팀 전체 업무 조회' },
  { label: '영업담당', email: 'sales1@workflow.co.kr', note: '거래처 · 파이프라인' },
  { label: '직원', email: 'staff1@workflow.co.kr', note: '내 업무만 조회' },
];

const DEMO_PASSWORD = 'workflow123';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, emptyActionState);
  const [email, setEmail] = useState('admin@workflow.co.kr');
  const [password, setPassword] = useState(DEMO_PASSWORD);

  return (
    <div className="space-y-8">
      <header className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">로그인</h1>
        <p className="text-sm text-ink-soft">사내 계정으로 WorkFlow 에 접속하세요.</p>
      </header>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ''} />

        <Field label="이메일" htmlFor="email" required>
          <TextInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@workflow.co.kr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>

        <Field label="비밀번호" htmlFor="password" required>
          <TextInput
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          {pending ? '확인 중...' : '로그인'}
        </Button>
      </form>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-bold text-ink">데모 계정</p>
          <p className="text-[11px] text-ink-faint">
            비밀번호 <code className="font-mono">{DEMO_PASSWORD}</code>
          </p>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-faint">
          역할에 따라 메뉴와 조회 범위가 달라집니다. 계정을 눌러 채운 뒤 로그인해보세요.
        </p>

        <ul className="grid gap-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                  email === account.email
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-surface hover:border-line-strong',
                )}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-ink">{account.label}</span>
                  <span className="block truncate text-[11px] text-ink-faint">{account.email}</span>
                </span>
                <span className="shrink-0 text-[11px] text-ink-faint">{account.note}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-xs text-ink-faint">
        계정이 없으신가요?{' '}
        <Link href="/signup" className="font-medium text-brand hover:text-brand-dark">
          가입 신청
        </Link>
      </p>
    </div>
  );
}
