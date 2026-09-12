import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  meta?: React.ReactNode;
}

export function PageHeader({ title, description, action, backHref, backLabel, meta }: PageHeaderProps) {
  return (
    <div className="mb-7 space-y-3">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-faint transition-colors hover:text-ink"
        >
          <ChevronLeft className="size-3.5" />
          {backLabel ?? '목록으로'}
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h1 className="font-display text-[1.35rem] font-semibold tracking-tight text-ink sm:text-2xl">
            {title}
          </h1>
          {description && <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">{description}</p>}
          {meta}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
