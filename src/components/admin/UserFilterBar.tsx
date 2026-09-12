'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, RotateCcw, Search } from 'lucide-react';

import { ROLES, ROLE_LABEL } from '@/lib/constants';
import { Select } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

const SORT_OPTIONS = [
  { value: 'latest', label: '최근 등록순' },
  { value: 'name', label: '이름순' },
  { value: 'hire', label: '입사일순' },
  { value: 'login', label: '최근 로그인순' },
  { value: 'oldest', label: '오래된 순' },
];

const FILTER_KEYS = ['q', 'role', 'department'];

export function UserFilterBar({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlKeyword = searchParams.get('q') ?? '';
  const [keyword, setKeyword] = useState(urlKeyword);
  const [syncedKeyword, setSyncedKeyword] = useState(urlKeyword);

  // 뒤로가기·초기화로 URL 이 바뀌면 입력값을 맞춘다. (렌더 중 조정이라 추가 렌더가 없다)
  if (urlKeyword !== syncedKeyword) {
    setSyncedKeyword(urlKeyword);
    setKeyword(urlKeyword);
  }

  const apply = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    params.delete('page');

    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  useEffect(() => {
    if (keyword === urlKeyword) return;

    const timer = setTimeout(() => apply({ q: keyword || undefined }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const activeCount = FILTER_KEYS.filter((key) => searchParams.get(key)).length;

  return (
    <div className="card mb-4 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="이름, 이메일, 사원번호, 연락처로 검색"
            aria-label="직원 검색"
            className="w-full rounded-lg border border-line-strong bg-surface py-2 pr-9 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          {pending && (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-faint" />
          )}
        </div>

        <Select
          aria-label="역할 필터"
          className="w-auto min-w-32"
          value={searchParams.get('role') ?? ''}
          onChange={(event) => apply({ role: event.target.value || undefined })}
        >
          <option value="">역할 전체</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="부서 필터"
          className="w-auto min-w-32"
          value={searchParams.get('department') ?? ''}
          onChange={(event) => apply({ department: event.target.value || undefined })}
        >
          <option value="">부서 전체</option>
          <option value="none">부서 미지정</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="정렬"
          className="w-auto min-w-36"
          value={searchParams.get('sort') ?? 'latest'}
          onChange={(event) =>
            apply({ sort: event.target.value === 'latest' ? undefined : event.target.value })
          }
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <button
          type="button"
          onClick={() => {
            setKeyword('');
            startTransition(() => {
              // 상태 탭은 별도 UI 로 제어하므로 초기화에서 유지한다.
              const status = searchParams.get('status');
              router.push(status ? `${pathname}?status=${status}` : pathname);
            });
          }}
          disabled={activeCount === 0}
          className={cn(
            'inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors',
            activeCount > 0
              ? 'text-ink-soft hover:bg-surface-muted hover:text-ink'
              : 'cursor-not-allowed text-ink-faint/60',
          )}
        >
          <RotateCcw className="size-3.5" />
          초기화{activeCount > 0 && ` (${activeCount})`}
        </button>
      </div>
    </div>
  );
}
