import Link from 'next/link';

import { buildQueryString, cn } from '@/lib/utils';

interface TabsProps {
  basePath: string;
  query: Record<string, string | undefined>;
  active: string;
  tabs: { value: string; label: string; count?: number }[];
}

/**
 * URL 쿼리로 상태를 관리하는 탭.
 * 클라이언트 상태를 쓰지 않아 새로고침·공유·뒤로가기에서 선택이 유지된다.
 */
export function Tabs({ basePath, query, active, tabs }: TabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {tabs.map((tab) => {
        const selected = tab.value === active;

        return (
          <Link
            key={tab.value}
            href={`${basePath}${buildQueryString(query, { tab: tab.value === tabs[0].value ? undefined : tab.value })}`}
            role="tab"
            aria-selected={selected}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
              selected
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-soft hover:border-line-strong hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[11px]',
                  selected ? 'bg-brand-soft text-brand-dark' : 'bg-surface-muted text-ink-faint',
                )}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
