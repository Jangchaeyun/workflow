'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';

import { logoutAction } from '@/actions/auth';
import { ROLE_LABEL, type Role } from '@/lib/constants';
import { Avatar } from '@/components/ui/Avatar';

interface UserMenuProps {
  name: string;
  email: string;
  role: Role;
  position: string | null;
  departmentName: string | null;
  avatarColor: string;
}

export function UserMenu({ name, email, role, position, departmentName, avatarColor }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const subtitle = [departmentName, position].filter(Boolean).join(' · ');

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 transition-colors hover:bg-surface-muted"
        aria-expanded={open}
        aria-label="내 계정 메뉴"
      >
        <Avatar name={name} color={avatarColor} size="sm" />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block truncate text-xs font-medium text-ink">{name}</span>
          <span className="block truncate text-[11px] text-ink-faint">{ROLE_LABEL[role]}</span>
        </span>
        <ChevronDown className="size-3.5 text-ink-faint" />
      </button>

      {open && (
        <div className="animate-fade-up absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            <Avatar name={name} color={avatarColor} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{name}</p>
              <p className="truncate text-xs text-ink-faint">{email}</p>
              {subtitle && <p className="mt-0.5 truncate text-[11px] text-ink-faint">{subtitle}</p>}
            </div>
          </div>

          <Link
            href="/settings/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 border-b border-line px-4 py-3 text-left text-sm text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <UserRound className="size-4" />
            내 프로필
          </Link>

          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <LogOut className="size-4" />
              로그아웃
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
