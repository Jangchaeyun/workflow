'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';
import { Download, FileText, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';

import { deleteAttachmentAction, uploadAttachmentAction } from '@/actions/tasks';
import { emptyActionState } from '@/lib/form';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/Field';

export interface AttachmentItem {
  id: string;
  fileName: string;
  size: string;
  uploaderName: string;
  createdAt: string;
}

interface TaskAttachmentsProps {
  taskId: string;
  attachments: AttachmentItem[];
  editable: boolean;
}

export function TaskAttachments({ taskId, attachments, editable }: TaskAttachmentsProps) {
  const [state, formAction, pending] = useActionState(uploadAttachmentAction, emptyActionState);
  const [deleting, startDelete] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="space-y-3">
      {attachments.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-3 text-xs text-ink-faint">
          <Paperclip className="size-3.5" />
          첨부된 파일이 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {attachments.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-faint">
                <FileText className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{file.fileName}</p>
                <p className="text-[11px] text-ink-faint">
                  {file.size} · {file.uploaderName} · {formatDateTime(file.createdAt)}
                </p>
              </div>

              <a
                href={`/api/attachments/${file.id}`}
                className="rounded p-1.5 text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
                aria-label={`${file.fileName} 다운로드`}
              >
                <Download className="size-3.5" />
              </a>

              {editable && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => startDelete(() => deleteAttachmentAction(file.id))}
                  className="rounded p-1.5 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                  aria-label={`${file.fileName} 삭제`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form ref={formRef} action={formAction} className="space-y-2">
          <input type="hidden" name="taskId" value={taskId} />
          <input
            type="file"
            name="files"
            multiple
            required
            aria-label="첨부할 파일 선택"
            className="w-full cursor-pointer rounded-lg border border-dashed border-line-strong bg-surface px-3 py-2.5 text-xs text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-brand-dark hover:border-brand"
          />
          <p className="text-[11px] text-ink-faint">
            파일당 10MB 이하. 실행 파일(.exe, .bat 등)은 업로드할 수 없습니다.
          </p>

          {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          {state.success && <FormMessage tone="success">{state.success}</FormMessage>}

          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            업로드
          </Button>
        </form>
      )}
    </div>
  );
}
