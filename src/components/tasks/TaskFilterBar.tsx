'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, RotateCcw, Search } from 'lucide-react';

import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
} from '@/lib/constants';
import { Select } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

interface TaskFilterBarProps {
  users: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  canFilterAssignee: boolean;
  /** 정렬 옵션 노출 여부 (칸반 보드에서는 숨긴다) */
  showSort?: boolean;
}

const SORT_OPTIONS = [
  { value: 'latest', label: '최근 등록순' },
  { value: 'oldest', label: '오래된 순' },
  { value: 'due', label: '마감일 순' },
  { value: 'priority', label: '우선순위 순' },
  { value: 'progress', label: '진행률 순' },
];

const DUE_OPTIONS = [
  { value: '', label: '마감 전체' },
  { value: 'today', label: '오늘 마감' },
  { value: 'week', label: '7일 내 마감' },
  { value: 'overdue', label: '마감 초과' },
];

/**
 * 필터 상태를 URL 쿼리에 담아 서버 컴포넌트가 다시 조회하도록 한다.
 * 클라이언트 배열 필터링이 아니라 서버 쿼리이므로 페이지네이션·건수와 항상 일치한다.
 */
export function TaskFilterBar({ users, clients, canFilterAssignee, showSort = true }: TaskFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlKeyword = searchParams.get('q') ?? '';
  const [keyword, setKeyword] = useState(urlKeyword);
  const [syncedKeyword, setSyncedKeyword] = useState(urlKeyword);

  // 뒤로가기나 초기화로 URL 이 바뀌면 입력값을 맞춰 준다.
  // 렌더 중 상태를 조정하는 방식이라 이펙트로 인한 추가 렌더가 발생하지 않는다.
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
    // 조건이 바뀌면 첫 페이지부터 다시 본다.
    params.delete('page');

    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  // 입력이 멈춘 뒤에만 조회해 타이핑마다 서버를 때리지 않는다.
  useEffect(() => {
    if (keyword === urlKeyword) return;

    const timer = setTimeout(() => apply({ q: keyword || undefined }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const activeCount = ['priority', 'category', 'assignee', 'client', 'due', 'q'].filter((key) =>
    searchParams.get(key),
  ).length;

  return (
    <div className="card mb-4 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="업무명, 업무번호, 거래처로 검색"
            aria-label="업무 검색"
            className="w-full rounded-lg border border-line-strong bg-surface py-2 pr-9 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          {pending && (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-faint" />
          )}
        </div>

        <Select
          aria-label="우선순위 필터"
          className="w-auto min-w-28"
          value={searchParams.get('priority') ?? ''}
          onChange={(event) => apply({ priority: event.target.value || undefined })}
        >
          <option value="">우선순위 전체</option>
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {TASK_PRIORITY_LABEL[priority]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="업무 분류 필터"
          className="w-auto min-w-28"
          value={searchParams.get('category') ?? ''}
          onChange={(event) => apply({ category: event.target.value || undefined })}
        >
          <option value="">분류 전체</option>
          {TASK_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {TASK_CATEGORY_LABEL[category]}
            </option>
          ))}
        </Select>

        {canFilterAssignee && (
          <Select
            aria-label="담당자 필터"
            className="w-auto min-w-32"
            value={searchParams.get('assignee') ?? ''}
            onChange={(event) => apply({ assignee: event.target.value || undefined })}
          >
            <option value="">담당자 전체</option>
            <option value="me">내 업무</option>
            <option value="none">미배정</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        )}

        <Select
          aria-label="거래처 필터"
          className="w-auto min-w-32"
          value={searchParams.get('client') ?? ''}
          onChange={(event) => apply({ client: event.target.value || undefined })}
        >
          <option value="">거래처 전체</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="마감 조건 필터"
          className="w-auto min-w-28"
          value={searchParams.get('due') ?? ''}
          onChange={(event) => apply({ due: event.target.value || undefined })}
        >
          {DUE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {showSort && (
          <Select
            aria-label="정렬"
            className="w-auto min-w-32"
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
        )}

        <button
          type="button"
          onClick={() => startTransition(() => router.push(pathname))}
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
