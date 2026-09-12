'use client';

import { useActionState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

import { createTaskAction, updateTaskAction } from '@/actions/tasks';
import { emptyActionState } from '@/lib/form';
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
} from '@/lib/constants';
import { toDateInputValue } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Select, Textarea, TextInput } from '@/components/ui/Field';

export interface TaskFormOptions {
  users: { id: string; name: string; label: string }[];
  clients: { id: string; name: string }[];
}

export interface TaskFormInitial {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  progress: number;
  assigneeId: string | null;
  clientId: string | null;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  estimatedHours: number | null;
  actualHours: number | null;
}

interface TaskFormModalProps {
  open: boolean;
  onClose: () => void;
  options: TaskFormOptions;
  canAssign: boolean;
  initial?: TaskFormInitial;
}

export function TaskFormModal({ open, onClose, options, canAssign, initial }: TaskFormModalProps) {
  const isEdit = Boolean(initial);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateTaskAction : createTaskAction,
    emptyActionState,
  );

  // 저장이 끝나면 모달을 닫는다. 서버 액션에서 revalidate 했으므로 목록은 이미 최신이다.
  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(onClose, 600);
      return () => clearTimeout(timer);
    }
  }, [state.success, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '업무 수정' : '업무 등록'}
      description={
        isEdit
          ? '변경 내용은 활동 로그에 기록됩니다.'
          : '담당자와 마감일을 지정하면 담당자에게 알림이 전송됩니다.'
      }
    >
      <form action={formAction} className="space-y-4">
        {initial && <input type="hidden" name="id" value={initial.id} />}

        <Field label="업무명" htmlFor="title" required>
          <TextInput
            id="title"
            name="title"
            defaultValue={initial?.title ?? ''}
            placeholder="예: 제안서 초안 작성"
            required
            maxLength={160}
          />
        </Field>

        <Field label="업무 내용" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            defaultValue={initial?.description ?? ''}
            placeholder="배경, 요구사항, 참고 사항을 적어주세요."
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="상태" htmlFor="status">
            <Select id="status" name="status" defaultValue={initial?.status ?? 'TODO'}>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABEL[status]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="우선순위" htmlFor="priority">
            <Select id="priority" name="priority" defaultValue={initial?.priority ?? 'MEDIUM'}>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {TASK_PRIORITY_LABEL[priority]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="분류" htmlFor="category">
            <Select id="category" name="category" defaultValue={initial?.category ?? 'GENERAL'}>
              {TASK_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {TASK_CATEGORY_LABEL[category]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="담당자"
            htmlFor="assigneeId"
            hint={canAssign ? undefined : '담당자 지정 권한이 없어 본인으로 등록됩니다.'}
          >
            <Select
              id="assigneeId"
              name="assigneeId"
              defaultValue={initial?.assigneeId ?? ''}
              disabled={!canAssign}
            >
              <option value="">미배정</option>
              {options.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                  {user.label ? ` (${user.label})` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="관련 거래처" htmlFor="clientId">
            <Select id="clientId" name="clientId" defaultValue={initial?.clientId ?? ''}>
              <option value="">선택 안 함</option>
              {options.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="시작일" htmlFor="startDate">
            <TextInput
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={toDateInputValue(initial?.startDate)}
            />
          </Field>
          <Field label="마감일" htmlFor="dueDate">
            <TextInput
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={toDateInputValue(initial?.dueDate)}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="예상 공수" htmlFor="estimatedHours" hint="시간 단위">
            <TextInput
              id="estimatedHours"
              name="estimatedHours"
              type="number"
              min={0}
              step={0.5}
              defaultValue={initial?.estimatedHours ?? ''}
            />
          </Field>

          {isEdit && (
            <>
              <Field label="실제 공수" htmlFor="actualHours" hint="시간 단위">
                <TextInput
                  id="actualHours"
                  name="actualHours"
                  type="number"
                  min={0}
                  step={0.5}
                  defaultValue={initial?.actualHours ?? ''}
                />
              </Field>
              <Field label="진행률" htmlFor="progress" hint="0~100">
                <TextInput
                  id="progress"
                  name="progress"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  defaultValue={initial?.progress ?? 0}
                />
              </Field>
            </>
          )}
        </div>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state.success && <FormMessage tone="success">{state.success}</FormMessage>}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? '변경 저장' : '업무 등록'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
