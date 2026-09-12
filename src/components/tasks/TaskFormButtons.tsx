'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  TaskFormModal,
  type TaskFormInitial,
  type TaskFormOptions,
} from './TaskFormModal';

interface CreateProps {
  options: TaskFormOptions;
  canAssign: boolean;
  /** 커맨드 팔레트·대시보드에서 ?new=1 로 들어올 때 모달을 바로 연다. */
  defaultOpen?: boolean;
}

export function TaskCreateButton({ options, canAssign, defaultOpen = false }: CreateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(defaultOpen);

  const close = () => {
    setOpen(false);
    if (defaultOpen && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('new')) {
        params.delete('new');
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      }
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        업무 등록
      </Button>
      <TaskFormModal open={open} onClose={close} options={options} canAssign={canAssign} />
    </>
  );
}

interface EditProps {
  options: TaskFormOptions;
  canAssign: boolean;
  initial: TaskFormInitial;
}

export function TaskEditButton({ options, canAssign, initial }: EditProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        수정
      </Button>
      <TaskFormModal
        open={open}
        onClose={() => setOpen(false)}
        options={options}
        canAssign={canAssign}
        initial={initial}
      />
    </>
  );
}
