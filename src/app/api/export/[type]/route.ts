import { NextResponse } from 'next/server';

import { getCurrentUser, getMyPermissions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { dealScopeWhere, getAccessScope, taskScopeWhere } from '@/lib/scope';
import { csvResponse, toCsv } from '@/lib/csv';
import {
  CLIENT_STATUS_LABEL,
  CONTRACT_STATUS_LABEL,
  DEAL_STAGE_LABEL,
  TASK_CATEGORY_LABEL,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  type ClientStatus,
  type ContractStatus,
  type DealStage,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export async function GET(
  request: Request,
  context: { params: Promise<{ type: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type } = await context.params;
  if (type !== 'tasks' && type !== 'clients' && type !== 'deals') {
    return NextResponse.json({ error: 'Unknown export type' }, { status: 400 });
  }

  const permissions = await getMyPermissions();
  const scope = await getAccessScope();
  const { searchParams } = new URL(request.url);
  const stamp = new Date().toISOString().slice(0, 10);

  try {
    if (type === 'tasks') {
      if (!permissions.has('task:read:own') && !permissions.has('task:read:all')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return await exportTasks(scope, searchParams, stamp);
    }
    if (type === 'clients') {
      if (!permissions.has('client:read')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return await exportClients(searchParams, stamp);
    }
    if (!permissions.has('deal:read:own') && !permissions.has('deal:read:all')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return await exportDeals(scope, searchParams, stamp);
  } catch (error) {
    console.error('[export]', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

async function exportTasks(
  scope: Awaited<ReturnType<typeof getAccessScope>>,
  searchParams: URLSearchParams,
  stamp: string,
) {
  const status = searchParams.get('status') ?? undefined;
  const rows = await prisma.task.findMany({
    where: {
      deletedAt: null,
      AND: [taskScopeWhere(scope)],
      ...(status ? { status } : {}),
    },
    select: {
      code: true,
      title: true,
      status: true,
      priority: true,
      category: true,
      progress: true,
      dueDate: true,
      client: { select: { name: true } },
      assignee: { select: { name: true } },
      reporter: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 2000,
  });

  const csv = toCsv(
    ['코드', '제목', '상태', '우선순위', '분류', '진행률', '마감일', '거래처', '담당자', '요청자', '등록일'],
    rows.map((row) => [
      row.code,
      row.title,
      TASK_STATUS_LABEL[row.status as TaskStatus] ?? row.status,
      TASK_PRIORITY_LABEL[row.priority as TaskPriority] ?? row.priority,
      TASK_CATEGORY_LABEL[row.category as TaskCategory] ?? row.category,
      row.progress,
      formatDate(row.dueDate),
      row.client?.name ?? '',
      row.assignee?.name ?? '',
      row.reporter.name,
      formatDate(row.createdAt),
    ]),
  );

  return csvResponse(`workflow-tasks-${stamp}.csv`, csv);
}

async function exportClients(searchParams: URLSearchParams, stamp: string) {
  const status = searchParams.get('status') ?? undefined;
  const rows = await prisma.client.findMany({
    where: {
      deletedAt: null,
      ...(status ? { status } : {}),
    },
    select: {
      code: true,
      name: true,
      status: true,
      grade: true,
      scale: true,
      industry: true,
      phone: true,
      email: true,
      owner: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 2000,
  });

  const csv = toCsv(
    ['코드', '거래처명', '상태', '등급', '규모', '업종', '전화', '이메일', '담당자', '등록일'],
    rows.map((row) => [
      row.code,
      row.name,
      CLIENT_STATUS_LABEL[row.status as ClientStatus] ?? row.status,
      row.grade,
      row.scale,
      row.industry ?? '',
      row.phone ?? '',
      row.email ?? '',
      row.owner?.name ?? '',
      formatDate(row.createdAt),
    ]),
  );

  return csvResponse(`workflow-clients-${stamp}.csv`, csv);
}

async function exportDeals(
  scope: Awaited<ReturnType<typeof getAccessScope>>,
  searchParams: URLSearchParams,
  stamp: string,
) {
  const stage = searchParams.get('stage') ?? undefined;
  const rows = await prisma.deal.findMany({
    where: {
      deletedAt: null,
      AND: [dealScopeWhere(scope)],
      ...(stage ? { stage } : {}),
    },
    select: {
      code: true,
      title: true,
      stage: true,
      amount: true,
      probability: true,
      contractStatus: true,
      expectedCloseDate: true,
      client: { select: { name: true } },
      owner: { select: { name: true } },
      createdAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 2000,
  });

  const csv = toCsv(
    ['코드', '제목', '단계', '금액', '확률', '계약상태', '예상마감', '거래처', '담당자', '등록일'],
    rows.map((row) => [
      row.code,
      row.title,
      DEAL_STAGE_LABEL[row.stage as DealStage] ?? row.stage,
      Math.round(row.amount),
      row.probability,
      CONTRACT_STATUS_LABEL[row.contractStatus as ContractStatus] ?? row.contractStatus,
      formatDate(row.expectedCloseDate),
      row.client.name,
      row.owner.name,
      formatDate(row.createdAt),
    ]),
  );

  return csvResponse(`workflow-deals-${stamp}.csv`, csv);
}
