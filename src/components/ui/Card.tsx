import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('card', className)}>{children}</section>;
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** 우측에 "전체 보기" 링크를 붙일 때 */
  moreHref?: string;
  moreLabel?: string;
}

export function CardHeader({ title, description, action, moreHref, moreLabel = '전체 보기' }: CardHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-faint">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {moreHref && (
          <Link
            href={moreHref}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-brand hover:text-brand-dark"
          >
            {moreLabel}
            <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}
