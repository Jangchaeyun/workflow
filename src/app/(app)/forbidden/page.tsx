import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { PERMISSION_LABEL, type PermissionKey } from '@/lib/permissions';
import { ROLE_LABEL } from '@/lib/constants';
import { Card } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';

export const metadata: Metadata = { title: '접근 권한 없음' };

export default async function ForbiddenPage({ searchParams }: PageProps<'/forbidden'>) {
  const user = await requireUser();
  const { permission } = await searchParams;

  const key = typeof permission === 'string' ? (permission as PermissionKey) : undefined;
  const label = key ? PERMISSION_LABEL[key] : undefined;

  return (
    <div className="mx-auto max-w-lg pt-10">
      <Card className="px-6 py-10 text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
          <ShieldAlert className="size-6" />
        </span>

        <h1 className="text-lg font-bold text-ink">접근 권한이 없습니다</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          현재 계정의 역할은 <strong className="text-ink">{ROLE_LABEL[user.role]}</strong> 입니다.
          {label ? (
            <>
              {' '}
              이 화면은 <strong className="text-ink">{label}</strong> 권한이 필요합니다.
            </>
          ) : (
            ' 이 화면에 필요한 권한이 부여되지 않았습니다.'
          )}
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          접근 시도는 활동 로그에 기록되었습니다. 업무상 권한이 필요하면 시스템 관리자에게 요청해주세요.
        </p>

        <div className="mt-7 flex justify-center gap-2">
          <LinkButton href="/dashboard" variant="secondary">
            대시보드로 이동
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
