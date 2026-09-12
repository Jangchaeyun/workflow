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

import { AXIS_STYLE, GRID_COLOR, TOOLTIP_STYLE } from './chartTheme';

interface TaskTrendChartProps {
  data: { label: string; created: number; completed: number }[];
}

/** 주 단위 등록량(막대)과 완료량(선)을 겹쳐 보여 처리 속도가 유입을 따라가는지 확인한다. */
export function TaskTrendChart({ data }: TaskTrendChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis dataKey="label" {...AXIS_STYLE} />
          <YAxis allowDecimals={false} {...AXIS_STYLE} />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(value, name) => [`${Number(value)}건`, String(name ?? '')]}
            labelFormatter={(label) => `${label} 주`}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          />
          <Bar dataKey="created" name="등록" fill="#99f6e4" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line
            type="monotone"
            dataKey="completed"
            name="완료"
            stroke="#0f766e"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: '#0f766e' }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
