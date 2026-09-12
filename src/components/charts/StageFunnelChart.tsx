'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { AXIS_STYLE, DEAL_STAGE_COLORS, TOOLTIP_STYLE, shortMoney } from './chartTheme';

interface StageFunnelChartProps {
  data: { stage: string; label: string; count: number; amount: number; weighted: number }[];
  height?: number;
}

/**
 * 단계별 파이프라인 금액을 가로 막대로 표현한 퍼널.
 * 세로 막대보다 단계 이름을 읽기 쉬워 단계가 많은 파이프라인에 적합하다.
 */
export function StageFunnelChart({ data, height = 240 }: StageFunnelChartProps) {
  if (data.every((row) => row.amount === 0)) {
    return <p className="py-10 text-center text-xs text-ink-faint">진행 중인 영업건이 없습니다.</p>;
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <XAxis type="number" tickFormatter={shortMoney} {...AXIS_STYLE} />
          <YAxis type="category" dataKey="label" width={68} {...AXIS_STYLE} />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value, name) => [
              `${Math.round(Number(value)).toLocaleString('ko-KR')}원`,
              String(name ?? ''),
            ]}
          />
          <Bar dataKey="amount" name="파이프라인 금액" radius={[0, 4, 4, 0]} maxBarSize={26}>
            {data.map((row) => (
              <Cell key={row.stage} fill={DEAL_STAGE_COLORS[row.stage] ?? '#cbd5e1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
