'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  CalendarCheck2,
  ChartPie,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Menu,
  Network,
  ScrollText,
  ShieldCheck,
  TrendingUp,
  Users,
  Workflow,
  X,
} from 'lucide-react';

import type { NavIcon, VisibleNavSection } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { CommandPalette, SearchTrigger } from '@/components/layout/CommandPalette';

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  today: CalendarCheck2,
  tasks: ListChecks,
  board: KanbanSquare,
  clients: Building2,
  pipeline: TrendingUp,
  report: ChartPie,
  users: Users,
  departments: Network,
  permissions: ShieldCheck,
  logs: ScrollText,
};

interface AppShellProps {
  nav: VisibleNavSection[];
  topbar: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ nav, topbar, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K 로 전역 검색을 연다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCommand = event.metaKey || event.ctrlKey;
      if (isCommand && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15.5rem_1fr]">
      {/* 데스크톱 사이드바 */}
      <div className="hidden bg-sidebar lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <SidebarBrand />
          <SidebarNav nav={nav} pathname={pathname} />
          <div className="border-t border-sidebar-line px-4 py-3">
            <p className="text-[11px] leading-relaxed text-sidebar-faint">
              ⌘K 로 업무·거래처·메뉴를
              <br />
              바로 검색할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="animate-fade-up relative flex h-full w-72 flex-col bg-sidebar shadow-pop">
            <div className="flex items-center justify-between border-b border-sidebar-line pr-2">
              <SidebarBrand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-sidebar-faint hover:bg-sidebar-muted hover:text-sidebar-ink"
                aria-label="메뉴 닫기"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarNav nav={nav} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-md lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-md p-2 text-ink-soft hover:bg-surface-muted lg:hidden"
            aria-label="메뉴 열기"
          >
            <Menu className="size-4" />
          </button>

          <div className="hidden min-w-0 flex-1 sm:block">
            <SearchTrigger onOpen={() => setSearchOpen(true)} />
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-lg p-2 text-ink-soft hover:bg-surface-muted sm:hidden"
            aria-label="검색"
          >
            <SearchIcon />
          </button>

          {topbar}
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-7 lg:py-8">{children}</main>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function SidebarBrand() {
  return (
    <Link href="/dashboard" className="flex h-14 shrink-0 items-center gap-2.5 px-5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
        <Workflow className="size-4.5" />
      </span>
      <span className="font-display text-base font-semibold tracking-tight text-white">WorkFlow</span>
    </Link>
  );
}

function SidebarNav({
  nav,
  pathname,
  onNavigate,
}: {
  nav: VisibleNavSection[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="주요 메뉴">
      {nav.map((section, index) => (
        <div key={section.label ?? `section-${index}`} className="space-y-1">
          {section.label && (
            <p className="px-2.5 pb-1 text-[10px] font-bold tracking-[0.12em] text-sidebar-faint uppercase">
              {section.label}
            </p>
          )}
          {section.items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-sidebar-ink hover:bg-sidebar-muted hover:text-white',
                )}
              >
                <Icon
                  className={cn(
                    'size-4 shrink-0 transition-colors',
                    active ? 'text-white' : 'text-sidebar-faint group-hover:text-white',
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/**
 * `/tasks` 와 `/tasks/board` 처럼 접두사가 겹치는 메뉴가 동시에 활성화되지 않도록
 * 정확히 일치하거나, 더 긴 형제 경로가 아닌 하위 경로일 때만 활성 처리한다.
 */
function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;

  const siblings = ['/tasks/board', '/sales/reports'];
  return !siblings.some((sibling) => sibling !== href && pathname.startsWith(sibling));
}
