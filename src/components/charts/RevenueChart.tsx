'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AXIS_STYLE, GRID_COLOR, TOOLTIP_STYLE, shortMoney } from './chartTheme';

interface RevenueChartProps {
  data: { label: string; revenue: number; target: number }[];
  height?: number;
}

/** 월별 수주 실적(막대) 대비 목표(선). 목표선을 넘겼는지 한눈에 보이도록 겹쳐 그린다. */
export function RevenueChart({ data, height = 260 }: RevenueChartProps) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" {...AXIS_STYLE} />
          <YAxis width={48} tickFormatter={shortMoney} {...AXIS_STYLE} />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value, name) => [
              `${Math.round(Number(value)).toLocaleString('ko-KR')}원`,
              String(name ?? ''),
            ]}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Bar dataKey="revenue" name="수주 실적" fill="#0f766e" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Line
            type="monotone"
            dataKey="target"
            name="목표"
            stroke="#d97706"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 3, strokeWidth: 0, fill: '#d97706' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
