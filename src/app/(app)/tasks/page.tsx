import type { Metadata } from 'next';
import Link from 'next/link';
import { KanbanSquare, ListChecks, MessageSquare, Paperclip } from 'lucide-react';

import { getMyPermissions, requirePermission } from '@/lib/auth';
import { getTaskFormOptions, getTaskList, type TaskFilters } from '@/data/tasks';
import { TASK_CATEGORY_LABEL, type TaskCategory } from '@/lib/constants';
import { cn, daysUntil, formatDate } from '@/lib/utils';

import { PageHeader } from '@/components/layout/PageHeader';
import { LinkButton } from '@/components/ui/Button';
import { ExportCsvButton } from '@/components/ui/ExportCsvButton';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Avatar } from '@/components/ui/Avatar';
import { Progress, toneForProgress } from '@/components/ui/Progress';
import { TaskPriorityBadge, TaskStatusBadge } from '@/components/ui/StatusBadge';
import { TaskFilterBar } from '@/components/tasks/TaskFilterBar';
import { TaskStatusTabs } from '@/components/tasks/TaskStatusTabs';
import { TaskCreateButton } from '@/components/tasks/TaskFormButtons';

export const metadata: Metadata = { title: '업무 목록' };

export default async function TasksPage({ searchParams }: PageProps<'/tasks'>) {
  await requirePermission('task:read:own');

  const raw = await searchParams;
  const filters: TaskFilters = {
    q: pick(raw.q),
    status: pick(raw.status),
    priority: pick(raw.priority),
    category: pick(raw.category),
    assignee: pick(raw.assignee),
    client: pick(raw.client),
    due: pick(raw.due),
    sort: pick(raw.sort),
    page: pick(raw.page),
  };

  const [permissions, options, result] = await Promise.all([
    getMyPermissions(),
    getTaskFormOptions(),
    getTaskList(filters),
  ]);

  const canCreate = permissions.has('task:create');
  const canAssign = permissions.has('task:assign');
  const canSeeAll = permissions.has('task:read:all');

  const query = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value)),
  ) as Record<string, string>;

  return (
    <>
      <PageHeader
        title="업무 목록"
        description={
          canSeeAll
            ? '조직 전체 업무를 조회하고 담당자를 배정할 수 있습니다.'
            : '내가 담당·요청·참조 중인 업무를 조회합니다.'
        }
        action={
          <>
            <ExportCsvButton type="tasks" query={{ status: filters.status }} />
            <LinkButton href="/tasks/board" variant="secondary">
              <KanbanSquare className="size-4" />
              칸반 보드
            </LinkButton>
            {canCreate && (
              <TaskCreateButton
                options={options}
                canAssign={canAssign}
                defaultOpen={pick(raw.new) === '1'}
              />
            )}
          </>
        }
      />

      <TaskStatusTabs
        basePath="/tasks"
        query={query}
        counts={result.statusCounts}
        active={filters.status}
      />

      <TaskFilterBar
        users={options.users.map((user) => ({ id: user.id, name: user.name }))}
        clients={options.clients}
        canFilterAssignee={canSeeAll}
      />

      <Card>
        {result.items.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="size-5" />}
            title="조건에 맞는 업무가 없습니다."
            description="검색어나 필터를 조정해보세요."
          />
        ) : (
          <>
            {/* 데스크톱: 표 형태 */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-faint">
                    <th className="px-5 py-3 font-medium">업무</th>
                    <th className="px-3 py-3 font-medium">상태</th>
                    <th className="px-3 py-3 font-medium">우선순위</th>
                    <th className="px-3 py-3 font-medium">담당자</th>
                    <th className="px-3 py-3 font-medium">마감일</th>
                    <th className="w-40 px-3 py-3 font-medium">진행률</th>
                    <th className="px-5 py-3 font-medium">첨부</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {result.items.map((task) => {
                    const remaining = daysUntil(task.dueDate);
                    const late = task.status !== 'DONE' && remaining !== null && remaining < 0;

                    return (
                      <tr key={task.id} className="transition-colors hover:bg-surface-muted">
                        <td className="max-w-md px-5 py-3">
                          <Link href={`/tasks/${task.id}`} className="group block">
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-ink-faint">{task.code}</span>
                              <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-soft">
                                {TASK_CATEGORY_LABEL[task.category as TaskCategory] ?? task.category}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate font-medium text-ink group-hover:text-brand">
                              {task.title}
                            </span>
                            {task.client && (
                              <span className="block truncate text-xs text-ink-faint">
                                {task.client.name}
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <TaskStatusBadge value={task.status} />
                        </td>
                        <td className="px-3 py-3">
                          <TaskPriorityBadge value={task.priority} />
                        </td>
                        <td className="px-3 py-3">
                          {task.assignee ? (
                            <span className="flex items-center gap-2">
                              <Avatar
                                name={task.assignee.name}
                                color={task.assignee.avatarColor}
                                size="xs"
                              />
                              <span className="text-xs text-ink">{task.assignee.name}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-ink-faint">미배정</span>
                          )}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-3 text-xs whitespace-nowrap',
                            late ? 'font-medium text-danger' : 'text-ink-soft',
                          )}
                        >
                          {formatDate(task.dueDate)}
                          {late && <span className="block text-[11px]">{Math.abs(remaining!)}일 지연</span>}
                        </td>
                        <td className="px-3 py-3">
                          <Progress value={task.progress} tone={toneForProgress(task.progress)} />
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-2.5 text-xs text-ink-faint">
                            {task.commentCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <MessageSquare className="size-3.5" />
                                {task.commentCount}
                              </span>
                            )}
                            {task.attachmentCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Paperclip className="size-3.5" />
                                {task.attachmentCount}
                              </span>
                            )}
                            {task.commentCount === 0 && task.attachmentCount === 0 && '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 모바일: 카드 형태 */}
            <ul className="divide-y divide-line lg:hidden">
              {result.items.map((task) => (
                <li key={task.id}>
                  <Link href={`/tasks/${task.id}`} className="block px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <TaskStatusBadge value={task.status} />
                      <TaskPriorityBadge value={task.priority} />
                      <span className="ml-auto font-mono text-[11px] text-ink-faint">{task.code}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-ink">{task.title}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {[task.client?.name, task.assignee?.name ?? '미배정', formatDate(task.dueDate)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <div className="mt-2">
                      <Progress value={task.progress} tone={toneForProgress(task.progress)} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination
              page={result.page}
              total={result.total}
              pageSize={result.pageSize}
              basePath="/tasks"
              query={query}
            />
          </>
        )}
      </Card>
    </>
  );
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}
