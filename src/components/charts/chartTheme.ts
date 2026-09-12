/** 차트 전반에서 공유하는 축·격자·툴팁 스타일 (globals.css 의 토큰과 동일한 값) */

export const GRID_COLOR = '#e2e8eb';

export const AXIS_STYLE = {
  stroke: '#e2e8eb',
  tick: { fill: '#84939b', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #e2e8eb',
    boxShadow: '0 12px 28px -8px rgb(15 28 34 / 0.16)',
    fontSize: 12,
    padding: '8px 10px',
  },
  labelStyle: { color: '#44555e', fontWeight: 700, marginBottom: 2 },
  cursor: { fill: 'rgba(15, 118, 110, 0.06)' },
} as const;

/** 업무 상태 배지와 색을 맞춘 도넛 차트 팔레트 */
export const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: '#84939b',
  IN_PROGRESS: '#0f766e',
  REVIEW: '#0369a1',
  DONE: '#047857',
  HOLD: '#b45309',
};

export const DEAL_STAGE_COLORS: Record<string, string> = {
  LEAD: '#cbd5e1',
  QUALIFIED: '#7dd3fc',
  PROPOSAL: '#5eead4',
  NEGOTIATION: '#fbbf24',
  WON: '#047857',
  LOST: '#f87171',
};

/** 1_2000_0000 → "1.2억" (축 라벨용 축약 표기) */
export function shortMoney(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_0000_0000) return `${sign}${Number((abs / 1_0000_0000).toFixed(1))}억`;
  if (abs >= 1_0000) return `${sign}${Math.round(abs / 1_0000).toLocaleString('ko-KR')}만`;
  return `${sign}${abs.toLocaleString('ko-KR')}`;
}
