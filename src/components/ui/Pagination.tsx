import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildQueryString, cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  /** 현재 유지해야 할 검색·필터 쿼리 */
  query: Record<string, string | undefined>;
}

/**
 * 서버 렌더링 페이지네이션.
 * 링크 기반이라 필터 상태가 URL에 남고 새로고침·공유·뒤로가기가 그대로 동작한다.
 */
export function Pagination({ page, total, pageSize, basePath, query }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  // 현재 페이지 주변 5개만 노출
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  const hrefFor = (target: number) => `${basePath}${buildQueryString(query, { page: target === 1 ? undefined : target })}`;

  return (
    <nav className="flex items-center justify-between gap-4 border-t border-line px-5 py-3" aria-label="페이지 이동">
      <p className="text-xs text-ink-faint">
        전체 {total.toLocaleString('ko-KR')}건 · {page}/{totalPages} 페이지
      </p>

      <div className="flex items-center gap-1">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="이전 페이지">
          <ChevronLeft className="size-4" />
        </PageLink>

        {pages.map((target) => (
          <Link
            key={target}
            href={hrefFor(target)}
            aria-current={target === page ? 'page' : undefined}
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-md text-xs font-medium transition-colors',
              target === page
                ? 'bg-brand text-white'
                : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
            )}
          >
            {target}
          </Link>
        ))}

        <PageLink href={hrefFor(page + 1)} disabled={page >= totalPages} label="다음 페이지">
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex size-8 items-center justify-center rounded-md text-ink-faint/50" aria-hidden>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
    >
      {children}
    </Link>
  );
}
