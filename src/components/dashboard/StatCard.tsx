import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';

type Tone = 'brand' | 'positive' | 'caution' | 'danger' | 'info';

const TONE_CLASS: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand',
  positive: 'bg-positive-soft text-positive',
  caution: 'bg-caution-soft text-caution',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

const TONE_BAR: Record<Tone, string> = {
  brand: 'from-brand/80 to-brand/20',
  positive: 'from-positive/80 to-positive/20',
  caution: 'from-caution/80 to-caution/20',
  danger: 'from-danger/80 to-danger/20',
  info: 'from-info/80 to-info/20',
};

interface StatCardProps {
  label: string;
  value: number | string;
  unit?: string;
  hint?: string;
  tone?: Tone;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}

export function StatCard({ label, value, unit, hint, tone = 'brand', icon: Icon, href }: StatCardProps) {
  const body = (
    <>
      <div
        className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-80', TONE_BAR[tone])}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-ink-soft">{label}</p>
        <span className={cn('flex size-9 items-center justify-center rounded-xl', TONE_CLASS[tone])}>
          <Icon className="size-4" />
        </span>
      </div>

      <p className="mt-3.5 flex items-baseline gap-1">
        <span className="font-display text-[1.65rem] leading-none font-semibold tracking-tight text-ink">
          {typeof value === 'number' ? value.toLocaleString('ko-KR') : value}
        </span>
        {unit && <span className="text-xs font-medium text-ink-faint">{unit}</span>}
      </p>

      {hint && <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">{hint}</p>}

      {href && (
        <ArrowUpRight className="absolute right-4 bottom-4 size-3.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="card group relative block overflow-hidden px-4 py-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
      >
        {body}
      </Link>
    );
  }

  return <div className="card relative overflow-hidden px-4 py-4">{body}</div>;
}
