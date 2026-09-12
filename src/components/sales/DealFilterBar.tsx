'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, RotateCcw, Search } from 'lucide-react';

import { CONTRACT_STATUSES, CONTRACT_STATUS_LABEL } from '@/lib/constants';
import { Select } from '@/components/ui/Field';
import { cn } from '@/lib/utils';

interface DealFilterBarProps {
  owners: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  /** 담당자 필터를 노출할지 (본인 건만 볼 수 있는 사용자에게는 의미가 없다) */
  showOwnerFilter: boolean;
  /** 목록 화면에서만 정렬을 노출한다. */
  showSort?: boolean;
}

const CLOSE_OPTIONS = [
  { value: '', label: '마감 전체' },
  { value: 'month', label: '이번 달 마감' },
  { value: 'quarter', label: '이번 분기 마감' },
  { value: 'overdue', label: '마감일 초과' },
];

const SORT_OPTIONS = [
  { value: 'latest', label: '최근 등록순' },
  { value: 'amount', label: '금액 큰 순' },
  { value: 'close', label: '마감 임박순' },
  { value: 'probability', label: '수주 확률순' },
  { value: 'oldest', label: '오래된 순' },
];

const FILTER_KEYS = ['q', 'contract', 'owner', 'client', 'close'];

export function DealFilterBar({ owners, clients, showOwnerFilter, showSort = false }: DealFilterBarProps) {
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

  // 타이핑이 멈춘 뒤에만 이동해 매 글자마다 서버 조회가 발생하지 않게 한다.
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
            placeholder="영업건명, 코드, 거래처명으로 검색"
            aria-label="영업건 검색"
            className="w-full rounded-lg border border-line-strong bg-surface py-2 pr-9 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          {pending && (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-faint" />
          )}
        </div>

        <Select
          aria-label="거래처 필터"
          className="w-auto min-w-36"
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
          aria-label="계약 상태 필터"
          className="w-auto min-w-32"
          value={searchParams.get('contract') ?? ''}
          onChange={(event) => apply({ contract: event.target.value || undefined })}
        >
          <option value="">계약 전체</option>
          {CONTRACT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CONTRACT_STATUS_LABEL[status]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="마감 예정 필터"
          className="w-auto min-w-32"
          value={searchParams.get('close') ?? ''}
          onChange={(event) => apply({ close: event.target.value || undefined })}
        >
          {CLOSE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {showOwnerFilter && (
          <Select
            aria-label="담당 영업 필터"
            className="w-auto min-w-32"
            value={searchParams.get('owner') ?? ''}
            onChange={(event) => apply({ owner: event.target.value || undefined })}
          >
            <option value="">담당 전체</option>
            <option value="me">내 영업건</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </Select>
        )}

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
          onClick={() => {
            setKeyword('');
            startTransition(() => {
              // 보기 모드(view)는 필터가 아니므로 초기화에서 유지한다.
              const view = searchParams.get('view');
              router.push(view ? `${pathname}?view=${view}` : pathname);
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
