import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'brand' | 'positive' | 'caution' | 'danger' | 'info';

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-soft ring-line-strong',
  brand: 'bg-brand-soft text-brand-dark ring-brand/20',
  positive: 'bg-positive-soft text-positive ring-positive/20',
  caution: 'bg-caution-soft text-caution ring-caution/20',
  danger: 'bg-danger-soft text-danger ring-danger/20',
  info: 'bg-info-soft text-info ring-info/20',
};

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
  /** 좌측에 상태색 점을 표시 */
  dot?: boolean;
}

export function Badge({ children, tone = 'neutral', className, dot = false }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
