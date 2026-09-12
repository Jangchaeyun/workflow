'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, RotateCcw, Search } from 'lucide-react';

import {
  CLIENT_GRADES,
  CLIENT_SCALES,
  CLIENT_SCALE_LABEL,
} from '@/lib/constants';
import { Select } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

interface ClientFilterBarProps {
  owners: { id: string; name: string }[];
}

const SORT_OPTIONS = [
  { value: 'latest', label: '최근 등록순' },
  { value: 'name', label: '거래처명 순' },
  { value: 'grade', label: '등급 순' },
  { value: 'oldest', label: '오래된 순' },
];

export function ClientFilterBar({ owners }: ClientFilterBarProps) {
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

  const activeCount = ['q', 'grade', 'scale', 'owner'].filter((key) => searchParams.get(key)).length;

  return (
    <div className="card mb-4 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="거래처명, 사업자번호, 업종, 담당자명으로 검색"
            aria-label="거래처 검색"
            className="w-full rounded-lg border border-line-strong bg-surface py-2 pr-9 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          {pending && (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-faint" />
          )}
        </div>

        <Select
          aria-label="등급 필터"
          className="w-auto min-w-24"
          value={searchParams.get('grade') ?? ''}
          onChange={(event) => apply({ grade: event.target.value || undefined })}
        >
          <option value="">등급 전체</option>
          {CLIENT_GRADES.map((grade) => (
            <option key={grade} value={grade}>
              {grade}등급
            </option>
          ))}
        </Select>

        <Select
          aria-label="기업 규모 필터"
          className="w-auto min-w-28"
          value={searchParams.get('scale') ?? ''}
          onChange={(event) => apply({ scale: event.target.value || undefined })}
        >
          <option value="">규모 전체</option>
          {CLIENT_SCALES.map((scale) => (
            <option key={scale} value={scale}>
              {CLIENT_SCALE_LABEL[scale]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="담당 영업 필터"
          className="w-auto min-w-32"
          value={searchParams.get('owner') ?? ''}
          onChange={(event) => apply({ owner: event.target.value || undefined })}
        >
          <option value="">담당 전체</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name}
            </option>
          ))}
        </Select>

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
