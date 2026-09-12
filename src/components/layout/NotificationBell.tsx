'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';

import { markAllReadAction } from '@/actions/notifications';
import { cn, formatRelativeTime } from '@/lib/utils';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  items: NotificationItem[];
  unreadCount: number;
}

export function NotificationBell({ items, unreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg p-2 text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
        aria-label={`알림 ${unreadCount}건`}
        aria-expanded={open}
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-fade-up absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-ink">알림</p>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => markAllReadAction())}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark disabled:opacity-50"
              >
                <CheckCheck className="size-3.5" />
                모두 읽음
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-ink-faint">받은 알림이 없습니다.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {items.map((item) => {
                const content = (
                  <>
                    <div className="flex items-start gap-2">
                      {!item.isRead && (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" aria-label="읽지 않음" />
                      )}
                      <div className={cn('min-w-0', item.isRead && 'pl-3.5')}>
                        <p className="text-xs font-medium text-ink">{item.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{item.message}</p>
                        <p className="mt-1 text-[11px] text-ink-faint">
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </>
                );

                return (
                  <li key={item.id} className={cn(!item.isRead && 'bg-brand-soft/40')}>
                    {item.link ? (
                      <Link
                        href={item.link}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 transition-colors hover:bg-surface-muted"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
