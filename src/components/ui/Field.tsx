import { cn } from '@/lib/utils';

const CONTROL =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-brand focus:outline-none disabled:bg-surface-muted disabled:text-ink-faint';

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, required, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-ink-soft">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : (
        hint && <p className="text-xs text-ink-faint">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'min-h-24 resize-y', className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        CONTROL,
        // 기본 화살표를 커스텀 SVG로 교체해 브라우저별 차이를 없앤다.
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2398a2b3%22><path d=%22M5.25 7.5 10 12.25 14.75 7.5z%22/></svg>')] bg-[length:20px_20px] bg-[right_0.5rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    />
  );
}

/** 서버 액션 결과 메시지 */
export function FormMessage({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-3 py-2 text-xs font-medium',
        tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-positive-soft text-positive',
      )}
    >
      {children}
    </p>
  );
}
