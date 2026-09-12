'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { TASK_STATUS_COLORS, TOOLTIP_STYLE } from './chartTheme';

interface StatusDonutChartProps {
  data: { status: string; label: string; count: number }[];
}

export function StatusDonutChart({ data }: StatusDonutChartProps) {
  const total = data.reduce((sum, row) => sum + row.count, 0);
  const visible = data.filter((row) => row.count > 0);

  if (total === 0) {
    return <p className="py-10 text-center text-xs text-ink-faint">표시할 업무가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible}
              dataKey="count"
              nameKey="label"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={2}
              stroke="none"
            >
              {visible.map((row) => (
                <Cell key={row.status} fill={TASK_STATUS_COLORS[row.status] ?? '#cbd5e1'} />
              ))}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} formatter={(value) => `${Number(value)}건`} />
          </PieChart>
        </ResponsiveContainer>

        {/* 도넛 중앙에 총계를 얹어 별도 카드 없이 합계를 읽을 수 있게 한다. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-ink">{total.toLocaleString('ko-KR')}</span>
          <span className="text-[11px] text-ink-faint">전체 업무</span>
        </div>
      </div>

      <ul className="w-full flex-1 space-y-2">
        {data.map((row) => (
          <li key={row.status} className="flex items-center gap-2 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: TASK_STATUS_COLORS[row.status] ?? '#cbd5e1' }}
              aria-hidden
            />
            <span className="flex-1 text-ink-soft">{row.label}</span>
            <span className="font-medium text-ink">{row.count}건</span>
            <span className="w-9 text-right text-ink-faint">
              {total ? Math.round((row.count / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
