import Link from 'next/link';

import { TASK_BOARD_COLUMNS, TASK_STATUS_LABEL } from '@/lib/constants';
import { buildQueryString, cn } from '@/lib/utils';

interface TaskStatusTabsProps {
  basePath: string;
  query: Record<string, string | undefined>;
  counts: Record<string, number>;
  active?: string;
}

export function TaskStatusTabs({ basePath, query, counts, active }: TaskStatusTabsProps) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const tabs = [
    { value: undefined, label: '전체', count: total },
    ...TASK_BOARD_COLUMNS.map((status) => ({
      value: status as string | undefined,
      label: TASK_STATUS_LABEL[status],
      count: counts[status] ?? 0,
    })),
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="업무 상태">
      {tabs.map((tab) => {
        const selected = (active ?? undefined) === tab.value;

        return (
          <Link
            key={tab.value ?? 'all'}
            href={`${basePath}${buildQueryString(query, { status: tab.value, page: undefined })}`}
            role="tab"
            aria-selected={selected}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              selected
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
            )}
          >
            {tab.label}
            <span className={cn('text-[11px]', selected ? 'text-white/75' : 'text-ink-faint')}>
              {tab.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
