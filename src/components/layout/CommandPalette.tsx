'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CornerDownLeft,
  FileSearch,
  Handshake,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Search,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SearchResult, SearchResultKind } from '@/lib/search-types';

const KIND_META: Record<
  SearchResultKind,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  nav: { label: '이동', icon: LayoutDashboard },
  task: { label: '업무', icon: ListChecks },
  client: { label: '거래처', icon: Building2 },
  deal: { label: '영업건', icon: Handshake },
};

const QUICK_ACTIONS = [
  { label: '오늘 할 일', href: '/today', hint: '통합 인박스' },
  { label: '새 업무', href: '/tasks?new=1', hint: '업무 등록' },
  { label: '오늘 마감', href: '/tasks?due=today', hint: '마감 업무' },
  { label: '파이프라인', href: '/sales', hint: '영업 보드' },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => {
    onOpenChange(false);
    setQuery('');
    setActiveIndex(0);
  }, [onOpenChange]);

  // 열릴 때 입력창에 포커스
  useEffect(() => {
    if (!open) return;
    const timer = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(timer);
  }, [open]);

  // 검색 — setState 는 타이머/비동기 콜백에서만 호출해 이펙트 동기 setState 린트를 피한다.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const delay = query ? 220 : 0;
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data: { results?: SearchResult[] }) => {
          if (cancelled) return;
          setResults(data.results ?? []);
          setActiveIndex(0);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  const go = useCallback(
    (href: string) => {
      close();
      startTransition(() => router.push(href));
    },
    [close, router],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      go(results[activeIndex].href);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<SearchResultKind, SearchResult[]>();
    for (const item of results) {
      const list = map.get(item.kind) ?? [];
      list.push(item);
      map.set(item.kind, list);
    }
    return map;
  }, [results]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
        aria-label="검색 닫기"
        onClick={close}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="전역 검색"
        className="animate-scale-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          {loading || pending ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-brand" />
          ) : (
            <Search className="size-4 shrink-0 text-ink-faint" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="업무, 거래처, 영업건, 메뉴 검색…"
            className="h-14 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            aria-controls={listId}
            aria-autocomplete="list"
          />
          <kbd className="hidden rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-faint sm:inline">
            ESC
          </kbd>
        </div>

        {!query && (
          <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.href}
                type="button"
                onClick={() => go(action.href)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand/30 hover:bg-brand-soft hover:text-brand-dark"
              >
                {action.label}
                <span className="text-[10px] text-ink-faint">{action.hint}</span>
              </button>
            ))}
          </div>
        )}

        <div id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <FileSearch className="size-8 text-ink-faint/70" />
              <p className="text-sm font-medium text-ink">검색 결과가 없습니다</p>
              <p className="text-xs text-ink-faint">코드·제목·거래처명으로 다시 검색해 보세요.</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([kind, items]) => {
              const meta = KIND_META[kind];
              return (
                <div key={kind} className="px-2 py-1">
                  <p className="px-2 py-1.5 text-[11px] font-bold tracking-wide text-ink-faint uppercase">
                    {meta.label}
                  </p>
                  <ul>
                    {items.map((item) => {
                      flatIndex += 1;
                      const index = flatIndex;
                      const Icon = meta.icon;
                      const active = index === activeIndex;

                      return (
                        <li key={`${item.kind}-${item.id}`}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => go(item.href)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                              active ? 'bg-brand-soft text-brand-dark' : 'hover:bg-surface-muted',
                            )}
                          >
                            <span
                              className={cn(
                                'flex size-8 shrink-0 items-center justify-center rounded-lg',
                                active ? 'bg-white text-brand' : 'bg-surface-muted text-ink-faint',
                              )}
                            >
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">
                                {item.title}
                              </span>
                              <span className="block truncate text-xs text-ink-faint">
                                {item.subtitle}
                              </span>
                            </span>
                            {active && (
                              <span className="hidden items-center gap-1 text-[10px] text-ink-faint sm:inline-flex">
                                <CornerDownLeft className="size-3" />
                                이동
                              </span>
                            )}
                            <ArrowRight
                              className={cn(
                                'size-3.5 shrink-0',
                                active ? 'text-brand' : 'text-ink-faint opacity-0',
                              )}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-surface-muted/70 px-4 py-2 text-[11px] text-ink-faint">
          <span>↑↓ 이동 · Enter 열기</span>
          <span>업무 · 거래처 · 영업건 · 메뉴</span>
        </div>
      </div>
    </div>
  );
}

/** 탑바에서 검색창을 여는 트리거 버튼 */
export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-9 w-full max-w-xs items-center gap-2 rounded-xl border border-line bg-surface-muted/80 px-3 text-left text-sm text-ink-faint transition-colors hover:border-line-strong hover:bg-surface hover:text-ink-soft"
    >
      <Search className="size-3.5 shrink-0" />
      <span className="flex-1 truncate">검색…</span>
      <kbd className="hidden rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-faint sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
