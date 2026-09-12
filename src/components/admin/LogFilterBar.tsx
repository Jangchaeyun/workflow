'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, RotateCcw, Search } from 'lucide-react';

import { LOG_ACTIONS, LOG_ACTION_LABEL, LOG_ENTITY_LABEL } from '@/lib/constants';
import { Select } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

const RANGE_OPTIONS = [
  { value: '', label: '전체 기간' },
  { value: '7', label: '최근 7일' },
  { value: '30', label: '최근 30일' },
  { value: '90', label: '최근 90일' },
];

const FILTER_KEYS = ['q', 'action', 'entity', 'user', 'range'];

interface LogFilterBarProps {
  actors: { id: string; name: string }[];
  entityTypes: { value: string; count: number }[];
  actionCounts: Record<string, number>;
}

export function LogFilterBar({ actors, entityTypes, actionCounts }: LogFilterBarProps) {
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
            placeholder="활동 내용으로 검색"
            aria-label="활동 로그 검색"
            className="w-full rounded-lg border border-line-strong bg-surface py-2 pr-9 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          {pending && (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-faint" />
          )}
        </div>

        <Select
          aria-label="동작 필터"
          className="w-auto min-w-32"
          value={searchParams.get('action') ?? ''}
          onChange={(event) => apply({ action: event.target.value || undefined })}
        >
          <option value="">동작 전체</option>
          {LOG_ACTIONS.filter((action) => (actionCounts[action] ?? 0) > 0).map((action) => (
            <option key={action} value={action}>
              {LOG_ACTION_LABEL[action]} ({actionCounts[action]})
            </option>
          ))}
        </Select>

        <Select
          aria-label="대상 필터"
          className="w-auto min-w-32"
          value={searchParams.get('entity') ?? ''}
          onChange={(event) => apply({ entity: event.target.value || undefined })}
        >
          <option value="">대상 전체</option>
          {entityTypes.map((entity) => (
            <option key={entity.value} value={entity.value}>
              {LOG_ENTITY_LABEL[entity.value] ?? entity.value} ({entity.count})
            </option>
          ))}
        </Select>

        <Select
          aria-label="사용자 필터"
          className="w-auto min-w-32"
          value={searchParams.get('user') ?? ''}
          onChange={(event) => apply({ user: event.target.value || undefined })}
        >
          <option value="">사용자 전체</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="기간 필터"
          className="w-auto min-w-28"
          value={searchParams.get('range') ?? ''}
          onChange={(event) => apply({ range: event.target.value || undefined })}
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <button
          type="button"
          onClick={() => {
            setKeyword('');
            startTransition(() => router.push(pathname));
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
