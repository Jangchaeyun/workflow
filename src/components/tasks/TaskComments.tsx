'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';
import { Loader2, MessageSquare, SendHorizontal, Trash2 } from 'lucide-react';

import { addCommentAction, deleteCommentAction } from '@/actions/tasks';
import { emptyActionState } from '@/lib/form';
import { formatRelativeTime } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { FormMessage, Textarea } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';

export interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  authorPosition: string | null;
}

interface TaskCommentsProps {
  taskId: string;
  comments: CommentItem[];
  currentUserId: string;
  canModerate: boolean;
}

export function TaskComments({ taskId, comments, currentUserId, canModerate }: TaskCommentsProps) {
  const [state, formAction, pending] = useActionState(addCommentAction, emptyActionState);
  const [deleting, startDelete] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // 등록이 성공하면 입력창을 비워 연속 작성이 편하게 한다.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-5" />}
          title="아직 댓글이 없습니다."
          description="진행 상황이나 확인 사항을 남겨보세요."
        />
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar name={comment.authorName} color={comment.authorColor} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink">{comment.authorName}</span>
                  {comment.authorPosition && (
                    <span className="text-[11px] text-ink-faint">{comment.authorPosition}</span>
                  )}
                  <span className="text-[11px] text-ink-faint">
                    {formatRelativeTime(comment.createdAt)}
                  </span>

                  {(comment.authorId === currentUserId || canModerate) && (
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => startDelete(() => deleteCommentAction(comment.id))}
                      className="ml-auto rounded p-1 text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      aria-label="댓글 삭제"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 rounded-lg bg-surface-muted px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
                  {comment.content}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="space-y-2 border-t border-line pt-4">
        <input type="hidden" name="taskId" value={taskId} />
        <Textarea
          name="content"
          placeholder="댓글을 입력하세요. 담당자·요청자·참조자에게 알림이 전송됩니다."
          required
          maxLength={2000}
          className="min-h-20"
        />
        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
            등록
          </Button>
        </div>
      </form>
    </div>
  );
}
