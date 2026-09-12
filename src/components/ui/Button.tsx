import Link from 'next/link';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-brand text-white shadow-sm hover:bg-brand-dark active:translate-y-px disabled:bg-brand/50 disabled:shadow-none',
  secondary:
    'bg-surface text-ink ring-1 ring-line-strong ring-inset hover:bg-surface-muted hover:ring-ink-faint/40',
  ghost: 'text-ink-soft hover:bg-surface-muted hover:text-ink',
  danger: 'bg-danger text-white hover:bg-danger/90 active:translate-y-px',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
};

const BASE =
  'inline-flex items-center justify-center rounded-lg font-medium transition-[color,background-color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-60';

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(BASE, VARIANT_CLASS[variant], SIZE_CLASS[size], className);
}

interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

interface LinkButtonProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function LinkButton({ variant = 'primary', size = 'md', className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
