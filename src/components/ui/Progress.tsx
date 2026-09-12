import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  tone?: 'brand' | 'positive' | 'caution' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
}

const TONE_CLASS = {
  brand: 'bg-brand',
  positive: 'bg-positive',
  caution: 'bg-caution',
  danger: 'bg-danger',
} as const;

export function Progress({ value, tone = 'brand', size = 'sm', className, label }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn('flex-1 overflow-hidden rounded-full bg-line', size === 'sm' ? 'h-1.5' : 'h-2.5')}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? '진행률'}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', TONE_CLASS[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-medium text-ink-soft">{clamped}%</span>
    </div>
  );
}

/** 진행률 값에 따라 색을 자동 선택 (마감 임박/지연 표현용) */
export function toneForProgress(value: number): 'brand' | 'positive' | 'caution' | 'danger' {
  if (value >= 100) return 'positive';
  if (value >= 50) return 'brand';
  if (value > 0) return 'caution';
  return 'danger';
}
