'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Loader2, Target, Trash2 } from 'lucide-react';

import { deleteSalesTargetAction, saveSalesTargetAction } from '@/actions/deals';
import { emptyActionState } from '@/lib/form';
import { cn, formatCurrencyShort } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Select, TextInput } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Avatar';
import { Progress } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';

export interface SalesTargetRow {
  id: string;
  name: string;
  avatarColor: string;
  position: string | null;
  months: Record<number, number>;
  totalTarget: number;
  wonAmount: number;
  achievement: number;
}

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

interface SalesTargetPanelProps {
  year: number;
  rows: SalesTargetRow[];
  canEdit: boolean;
}

/**
 * 담당자 × 월 매출 목표 관리.
 *
 * 셀을 클릭하면 해당 담당자·월의 목표 입력 모달이 열린다.
 * 목표는 대시보드와 매출 통계의 "목표선"으로 그대로 사용된다.
 */
export function SalesTargetPanel({ year, rows, canEdit }: SalesTargetPanelProps) {
  const [editing, setEditing] = useState<{ userId: string; name: string; month: number } | null>(
    null,
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Target className="size-5" />}
        title="목표를 설정할 영업 담당자가 없습니다."
        description="직원 관리에서 역할을 영업담당 또는 팀장으로 지정하면 목록에 나타납니다."
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-ink-faint">
              <th className="sticky left-0 z-10 bg-surface px-5 py-3 text-left font-medium">담당자</th>
              {MONTHS.map((month) => (
                <th key={month} className="px-2 py-3 text-right font-medium whitespace-nowrap">
                  {month}월
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium whitespace-nowrap">연간 목표</th>
              <th className="w-40 px-5 py-3 text-left font-medium">달성률</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-surface-muted">
                <td className="sticky left-0 z-10 bg-surface px-5 py-3">
                  <span className="flex items-center gap-2">
                    <Avatar name={row.name} color={row.avatarColor} size="xs" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{row.name}</span>
                      {row.position && (
                        <span className="block truncate text-[11px] text-ink-faint">
                          {row.position}
                        </span>
                      )}
                    </span>
                  </span>
                </td>

                {MONTHS.map((month) => {
                  const amount = row.months[month] ?? 0;

                  return (
                    <td key={month} className="px-1 py-2 text-right">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setEditing({ userId: row.id, name: row.name, month })}
                        className={cn(
                          'w-full rounded px-1.5 py-1 text-right text-[11px] whitespace-nowrap transition-colors',
                          amount > 0 ? 'font-medium text-ink' : 'text-ink-faint',
                          canEdit ? 'hover:bg-brand-soft hover:text-brand-dark' : 'cursor-default',
                        )}
                        title={canEdit ? `${row.name} ${month}월 목표 설정` : undefined}
                      >
                        {amount > 0 ? formatCurrencyShort(amount) : '-'}
                      </button>
                    </td>
                  );
                })}

                <td className="px-3 py-3 text-right text-sm font-bold whitespace-nowrap text-ink">
                  {formatCurrencyShort(row.totalTarget)}
                </td>
                <td className="px-5 py-3">
                  <Progress
                    value={row.achievement}
                    tone={
                      row.achievement >= 100
                        ? 'positive'
                        : row.achievement >= 70
                          ? 'brand'
                          : 'caution'
                    }
                    label={`${row.name} 목표 달성률`}
                  />
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    실적 {formatCurrencyShort(row.wonAmount)}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <TargetFormModal
          year={year}
          userId={editing.userId}
          userName={editing.name}
          month={editing.month}
          currentAmount={rows.find((row) => row.id === editing.userId)?.months[editing.month] ?? 0}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function TargetFormModal({
  year,
  userId,
  userName,
  month,
  currentAmount,
  onClose,
}: {
  year: number;
  userId: string;
  userName: string;
  month: number;
  currentAmount: number;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveSalesTargetAction, emptyActionState);
  const [removing, startRemove] = useTransition();
  const [selectedMonth, setSelectedMonth] = useState(month);

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(onClose, 600);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose]);

  return (
    <Modal
      open
      onClose={onClose}
      title="영업 목표 설정"
      description={`${userName}님의 ${year}년 월별 매출 목표를 설정합니다.`}
      size="sm"
    >
      <form action={formAction} className="space-y-3.5">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="year" value={year} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="대상 월" htmlFor="target-month" required>
            <Select
              id="target-month"
              name="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(Number(event.target.value))}
            >
              {MONTHS.map((value) => (
                <option key={value} value={value}>
                  {value}월
                </option>
              ))}
            </Select>
          </Field>
          <Field label="목표 금액" htmlFor="targetAmount" required hint="원 단위">
            <TextInput
              id="targetAmount"
              name="targetAmount"
              required
              inputMode="numeric"
              defaultValue={currentAmount > 0 ? String(currentAmount) : ''}
              placeholder="50000000"
            />
          </Field>
        </div>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state.success && <FormMessage tone="success">{state.success}</FormMessage>}

        <div className="flex items-center justify-end gap-2 border-t border-line pt-3.5">
          {currentAmount > 0 && (
            <Button
              type="button"
              variant="ghost"
              disabled={removing || pending}
              onClick={() =>
                startRemove(async () => {
                  await deleteSalesTargetAction(userId, year, selectedMonth);
                  onClose();
                })
              }
              className="mr-auto"
            >
              {removing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-3.5" />}
              목표 삭제
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
