import Link from 'next/link';
import {
  Building2,
  CalendarCheck2,
  CalendarClock,
  KanbanSquare,
  Plus,
  TrendingUp,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface QuickAction {
  href: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}

interface DashboardQuickActionsProps {
  canCreateTask: boolean;
  canReadClients: boolean;
  canReadDeals: boolean;
}

export function DashboardQuickActions({
  canCreateTask,
  canReadClients,
  canReadDeals,
}: DashboardQuickActionsProps) {
  const actions: QuickAction[] = [
    {
      href: '/today',
      label: '오늘 할 일',
      hint: '마감 · 후속 통합',
      icon: CalendarCheck2,
      tone: 'bg-brand-soft text-brand',
    },
    canCreateTask
      ? {
          href: '/tasks?new=1',
          label: '업무 등록',
          hint: '새 할 일 추가',
          icon: Plus,
          tone: 'bg-positive-soft text-positive',
        }
      : null,
    {
      href: '/tasks?due=today',
      label: '오늘 마감',
      hint: '오늘 처리할 업무',
      icon: CalendarClock,
      tone: 'bg-caution-soft text-caution',
    },
    {
      href: '/tasks/board',
      label: '칸반 보드',
      hint: '상태별 진행 현황',
      icon: KanbanSquare,
      tone: 'bg-info-soft text-info',
    },
    canReadClients
      ? {
          href: '/clients',
          label: '거래처',
          hint: '고객 · 상담 기록',
          icon: Building2,
          tone: 'bg-positive-soft text-positive',
        }
      : null,
    canReadDeals
      ? {
          href: '/sales',
          label: '파이프라인',
          hint: '영업 단계 관리',
          icon: TrendingUp,
          tone: 'bg-brand-soft text-brand',
        }
      : null,
  ].filter(Boolean) as QuickAction[];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className="card group flex items-center gap-3 px-3.5 py-3 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
                action.tone,
              )}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{action.label}</span>
              <span className="block truncate text-[11px] text-ink-faint">{action.hint}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** 시간대별 인사말 */
export function greetingForHour(hour: number): string {
  if (hour < 6) return '늦은 밤에도 수고 많으십니다';
  if (hour < 12) return '좋은 아침입니다';
  if (hour < 18) return '좋은 오후입니다';
  return '좋은 저녁입니다';
}
