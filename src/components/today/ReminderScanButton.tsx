'use client';

import { useState, useTransition } from 'react';
import { BellRing, Loader2 } from 'lucide-react';

import { scanDueRemindersAction } from '@/actions/reminders';
import { Button } from '@/components/ui/Button';

export function ReminderScanButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await scanDueRemindersAction();
            setMessage(
              result.error
                ? result.error
                : `알림 ${result.created ?? 0}건 생성 (대상 ${result.scanned ?? 0}건)`,
            );
          });
        }}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <BellRing className="size-3.5" />}
        마감 알림 갱신
      </Button>
      {message && <p className="max-w-xs text-right text-[11px] text-ink-faint">{message}</p>}
    </div>
  );
}
