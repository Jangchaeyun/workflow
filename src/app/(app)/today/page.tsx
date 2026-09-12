import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlarmClock,
  Building2,
  CalendarCheck2,
  CalendarClock,
  Handshake,
  ListChecks,
  Sparkles,
} from 'lucide-react';

import { requirePermission } from '@/lib/auth';
import { getTodayAgenda, type TodayItem } from '@/data/today';
import { scanDueTaskReminders } from '@/lib/due-reminders';
import { formatCurrency, formatDate, formatDueLabel } from '@/lib/utils';
import { TASK_PRIORITY_LABEL, type TaskPriority } from '@/lib/constants';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { ReminderScanButton } from '@/components/today/ReminderScanButton';

export const metadata: Metadata = { title: '오늘 할 일' };

export default async function TodayPage() {
  await requirePermission('dashboard:view');

  // 화면 진입 시 마감 알림을 조용히 갱신한다 (실패해도 목록은 보여준다).
  await scanDueTaskReminders().catch(() => ({ created: 0, scanned: 0 }));

  const agenda = await getTodayAgenda();

  return (
    <>
      <PageHeader
        title="오늘 할 일"
        description="마감 업무 · 상담 후속 · 영업 마감을 하루 단위로 모았습니다."
        action={<ReminderScanButton />}
        meta={
          <p className="text-xs text-ink-faint">
            지연 {agenda.counts.overdue} · 오늘 {agenda.counts.today} · 7일 내 {agenda.counts.upcoming}
          </p>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label="지연"
          value={agenda.counts.overdue}
          icon={AlarmClock}
          tone="text-danger bg-danger-soft"
        />
        <SummaryTile
          label="오늘"
          value={agenda.counts.today}
          icon={CalendarCheck2}
          tone="text-brand bg-brand-soft"
        />
        <SummaryTile
          label="7일 내"
          value={agenda.counts.upcoming}
          icon={CalendarClock}
          tone="text-info bg-info-soft"
        />
      </div>

      <div className="space-y-5">
        <AgendaSection
          title="지연 · 즉시 처리"
          description="마감이 지난 항목"
          items={agenda.overdue}
          empty="지연된 항목이 없습니다."
          accent="danger"
        />
        <AgendaSection
          title="오늘"
          description="오늘 마감·후속 예정"
          items={agenda.today}
          empty="오늘 처리할 항목이 없습니다."
          accent="brand"
        />
        <AgendaSection
          title="다가오는 일정"
          description="앞으로 7일"
          items={agenda.upcoming}
          empty="7일 내 예정된 항목이 없습니다."
          accent="info"
        />
      </div>
    </>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="card flex items-center gap-3 px-4 py-3.5">
      <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs text-ink-faint">{label}</p>
        <p className="font-display text-xl font-semibold tracking-tight text-ink">{value}</p>
      </div>
    </div>
  );
}

function AgendaSection({
  title,
  description,
  items,
  empty,
  accent,
}: {
  title: string;
  description: string;
  items: TodayItem[];
  empty: string;
  accent: 'danger' | 'brand' | 'info';
}) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {items.length === 0 ? (
        <EmptyState
          title={empty}
          description="여유 있는 하루입니다."
          icon={<Sparkles className="size-8 text-ink-faint/60" />}
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted"
              >
                <KindIcon kind={item.kind} accent={accent} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                    <KindBadge kind={item.kind} />
                    {item.kind === 'task' && item.meta && (
                      <Badge tone={item.meta === 'URGENT' || item.meta === 'HIGH' ? 'caution' : 'neutral'}>
                        {TASK_PRIORITY_LABEL[item.meta as TaskPriority] ?? item.meta}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-faint">{item.subtitle}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-xs font-medium ${
                      item.bucket === 'overdue' ? 'text-danger' : 'text-ink-soft'
                    }`}
                  >
                    {formatDueLabel(item.when)}
                  </p>
                  <p className="text-[11px] text-ink-faint">{formatDate(item.when)}</p>
                  {item.kind === 'deal' && item.meta && (
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      {formatCurrency(Number(item.meta))}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function KindIcon({
  kind,
  accent,
}: {
  kind: TodayItem['kind'];
  accent: 'danger' | 'brand' | 'info';
}) {
  const tone =
    accent === 'danger'
      ? 'bg-danger-soft text-danger'
      : accent === 'brand'
        ? 'bg-brand-soft text-brand'
        : 'bg-info-soft text-info';
  const Icon = kind === 'task' ? ListChecks : kind === 'deal' ? Handshake : Building2;
  return (
    <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
      <Icon className="size-4" />
    </span>
  );
}

function KindBadge({ kind }: { kind: TodayItem['kind'] }) {
  const label = kind === 'task' ? '업무' : kind === 'deal' ? '영업' : '상담';
  return <Badge tone="neutral">{label}</Badge>;
}
