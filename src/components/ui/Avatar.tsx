import { cn, initials } from '@/lib/utils';

interface AvatarProps {
  name: string;
  color?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
} as const;

export function Avatar({ name, color, size = 'sm', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none',
        SIZE_CLASS[size],
        className,
      )}
      style={{ backgroundColor: color ?? '#98a2b3' }}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

interface UserChipProps {
  name: string;
  color?: string | null;
  sub?: string | null;
  size?: 'xs' | 'sm' | 'md';
}

export function UserChip({ name, color, sub, size = 'sm' }: UserChipProps) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name} color={color} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-sm text-ink">{name}</span>
        {sub && <span className="block truncate text-xs text-ink-faint">{sub}</span>}
      </span>
    </span>
  );
}
