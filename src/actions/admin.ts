'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db';
import { assertPermission } from '@/lib/auth';
import { diff, logActivity } from '@/lib/activity';
import { notify } from '@/lib/notifications';
import { countDepartmentMembers } from '@/data/admin';
import { formToObject, toActionError, type ActionState } from '@/lib/form';
import {
  departmentSchema,
  firstIssueMessage,
  userCreateSchema,
  userUpdateSchema,
} from '@/lib/validators';
import { ROLES, USER_STATUSES, USER_STATUS_LABEL, type Role, type UserStatus } from '@/lib/constants';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, type PermissionKey } from '@/lib/permissions';

const PASSWORD_ROUNDS = 10;

/** 사원번호를 비우면 EMP-0001 형태로 자동 부여해 목록 정렬·검색이 가능하게 한다. */
async function nextEmployeeNo(): Promise<string> {
  const last = await prisma.user.findFirst({
    where: { employeeNo: { startsWith: 'EMP-' } },
    orderBy: { employeeNo: 'desc' },
    select: { employeeNo: true },
  });

  const lastNumber = Number(last?.employeeNo?.replace('EMP-', '') ?? 0);
  const next = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
  return `EMP-${String(next).padStart(4, '0')}`;
}

const AVATAR_PALETTE = [
  '#0f766e',
  '#0369a1',
  '#047857',
  '#b45309',
  '#dc2626',
  '#0e7490',
  '#1d4ed8',
  '#be123c',
];

function pickAvatarColor(seed: string): string {
  const hash = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

// --- 직원 -------------------------------------------------------------------

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await assertPermission('user:create');
    const parsed = userCreateSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const input = parsed.data;

    const duplicate = await prisma.user.findUnique({ where: { email: input.email } });
    if (duplicate) return { error: '이미 사용 중인 이메일입니다.' };

    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: await bcrypt.hash(input.password, PASSWORD_ROUNDS),
        name: input.name,
        role: input.role,
        status: input.status,
        employeeNo: input.employeeNo ?? (await nextEmployeeNo()),
        position: input.position ?? null,
        phone: input.phone ?? null,
        departmentId: input.departmentId ?? null,
        hireDate: input.hireDate ?? null,
        avatarColor: pickAvatarColor(input.email),
      },
    });

    await logActivity({
      userId: admin.id,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      summary: `직원 등록: ${user.name} (${user.email}) · ${input.role}`,
    });

    revalidatePath('/admin/users');
    return { success: `${user.name}님을 등록했습니다.` };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await assertPermission('user:update');
    const parsed = userUpdateSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const input = parsed.data;
    const before = await prisma.user.findFirst({ where: { id: input.id, deletedAt: null } });
    if (!before) return { error: '직원을 찾을 수 없습니다.' };

    // 시스템에 관리자가 한 명도 남지 않는 상황을 만들 수 없게 막는다.
    if (before.role === 'ADMIN' && (input.role !== 'ADMIN' || input.status !== 'ACTIVE')) {
      const activeAdmins = await prisma.user.count({
        where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null, id: { not: input.id } },
      });
      if (activeAdmins === 0) {
        return { error: '마지막 관리자의 역할이나 상태는 변경할 수 없습니다.' };
      }
    }

    const data = {
      name: input.name,
      role: input.role,
      status: input.status,
      employeeNo: input.employeeNo ?? null,
      position: input.position ?? null,
      phone: input.phone ?? null,
      departmentId: input.departmentId ?? null,
      hireDate: input.hireDate ?? null,
      // 비밀번호는 입력했을 때만 교체한다.
      ...(input.password ? { password: await bcrypt.hash(input.password, PASSWORD_ROUNDS) } : {}),
    };

    await prisma.user.update({ where: { id: input.id }, data });

    const changes = diff(before as unknown as Record<string, unknown>, data);
    // 해시된 비밀번호가 감사 로그에 남지 않도록 값 대신 변경 사실만 기록한다.
    if ('password' in changes) changes.password = { before: '(변경 전)', after: '(재설정)' };

    await logActivity({
      userId: admin.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: input.id,
      summary: `직원 정보 수정: ${input.name}`,
      detail: changes,
    });

    revalidatePath('/admin/users');
    return { success: '직원 정보가 수정되었습니다.' };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * 가입 승인 · 이용정지 · 퇴사 처리.
 * 승인 시점에 당사자에게 알림을 보내 바로 로그인할 수 있음을 알린다.
 */
export async function changeUserStatusAction(userId: string, status: string): Promise<void> {
  const admin = await assertPermission('user:approve');

  if (!USER_STATUSES.includes(status as UserStatus)) {
    throw new Error('잘못된 상태값입니다.');
  }
  const nextStatus = status as UserStatus;

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new Error('직원을 찾을 수 없습니다.');
  if (user.status === nextStatus) return;

  if (user.role === 'ADMIN' && nextStatus !== 'ACTIVE') {
    const activeAdmins = await prisma.user.count({
      where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null, id: { not: userId } },
    });
    if (activeAdmins === 0) throw new Error('마지막 관리자는 비활성화할 수 없습니다.');
  }

  await prisma.user.update({ where: { id: userId }, data: { status: nextStatus } });

  await logActivity({
    userId: admin.id,
    action: 'STATUS_CHANGE',
    entityType: 'User',
    entityId: userId,
    summary: `계정 상태 변경: ${user.name} ${USER_STATUS_LABEL[user.status as UserStatus]} → ${USER_STATUS_LABEL[nextStatus]}`,
    detail: { before: user.status, after: nextStatus },
  });

  if (nextStatus === 'ACTIVE' && user.status === 'PENDING') {
    await notify({
      userId,
      type: 'USER_PENDING',
      title: '가입이 승인되었습니다',
      message: 'WorkFlow 에 로그인해 업무를 시작할 수 있습니다.',
      link: '/dashboard',
    });
  }

  revalidatePath('/admin/users');
}

export async function changeUserRoleAction(userId: string, role: string): Promise<void> {
  const admin = await assertPermission('user:update');

  if (!ROLES.includes(role as Role)) throw new Error('잘못된 역할입니다.');
  const nextRole = role as Role;

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new Error('직원을 찾을 수 없습니다.');
  if (user.role === nextRole) return;

  if (user.role === 'ADMIN') {
    const activeAdmins = await prisma.user.count({
      where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null, id: { not: userId } },
    });
    if (activeAdmins === 0) throw new Error('마지막 관리자의 역할은 변경할 수 없습니다.');
  }

  await prisma.user.update({ where: { id: userId }, data: { role: nextRole } });

  await logActivity({
    userId: admin.id,
    action: 'PERMISSION_CHANGE',
    entityType: 'User',
    entityId: userId,
    summary: `역할 변경: ${user.name} ${user.role} → ${nextRole}`,
    detail: { before: user.role, after: nextRole },
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin/permissions');
}

export async function deleteUserAction(userId: string): Promise<void> {
  const admin = await assertPermission('user:delete');

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw new Error('직원을 찾을 수 없습니다.');

  if (user.id === admin.id) throw new Error('본인 계정은 삭제할 수 없습니다.');

  if (user.role === 'ADMIN') {
    const activeAdmins = await prisma.user.count({
      where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null, id: { not: userId } },
    });
    if (activeAdmins === 0) throw new Error('마지막 관리자는 삭제할 수 없습니다.');
  }

  // 담당 중인 업무·영업건이 남아 있으면 인수인계 없이 사라지므로 먼저 알린다.
  const [openTasks, openDeals] = await Promise.all([
    prisma.task.count({ where: { assigneeId: userId, deletedAt: null, status: { not: 'DONE' } } }),
    prisma.deal.count({
      where: { ownerId: userId, deletedAt: null, stage: { notIn: ['WON', 'LOST'] } },
    }),
  ]);

  if (openTasks > 0 || openDeals > 0) {
    throw new Error(
      `진행 중인 업무 ${openTasks}건, 영업건 ${openDeals}건이 남아 있습니다. 담당자를 먼저 변경해주세요.`,
    );
  }

  // 이메일 유니크 제약 때문에 소프트 삭제만으로는 같은 주소를 재사용할 수 없어
  // 삭제 표시와 함께 이메일을 보관용으로 치환한다.
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date(),
      status: 'RESIGNED',
      email: `deleted+${userId}@workflow.local`,
    },
  });

  await logActivity({
    userId: admin.id,
    action: 'DELETE',
    entityType: 'User',
    entityId: userId,
    summary: `직원 삭제: ${user.name} (${user.email})`,
  });

  revalidatePath('/admin/users');
}

// --- 부서 -------------------------------------------------------------------

export async function saveDepartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await assertPermission('department:manage');
    const parsed = departmentSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

    const input = parsed.data;
    const departmentId = String(formData.get('id') ?? '');

    const data = {
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      costCenter: input.costCenter ?? null,
    };

    if (departmentId) {
      const before = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!before) return { error: '부서를 찾을 수 없습니다.' };

      await prisma.department.update({ where: { id: departmentId }, data });

      await logActivity({
        userId: admin.id,
        action: 'UPDATE',
        entityType: 'Department',
        entityId: departmentId,
        summary: `부서 수정: ${input.name} (${input.code})`,
        detail: diff(before as unknown as Record<string, unknown>, data),
      });
    } else {
      const created = await prisma.department.create({ data });

      await logActivity({
        userId: admin.id,
        action: 'CREATE',
        entityType: 'Department',
        entityId: created.id,
        summary: `부서 등록: ${input.name} (${input.code})`,
      });
    }

    revalidatePath('/admin/departments');
    revalidatePath('/admin/users');
    return { success: departmentId ? '부서 정보가 수정되었습니다.' : '부서가 등록되었습니다.' };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteDepartmentAction(departmentId: string): Promise<void> {
  const admin = await assertPermission('department:manage');

  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) throw new Error('부서를 찾을 수 없습니다.');

  const members = await countDepartmentMembers(departmentId);
  if (members > 0) {
    throw new Error(`소속 직원이 ${members}명 있어 삭제할 수 없습니다. 먼저 소속을 변경해주세요.`);
  }

  await prisma.department.delete({ where: { id: departmentId } });

  await logActivity({
    userId: admin.id,
    action: 'DELETE',
    entityType: 'Department',
    entityId: departmentId,
    summary: `부서 삭제: ${department.name} (${department.code})`,
  });

  revalidatePath('/admin/departments');
}

// --- 권한 매트릭스 ----------------------------------------------------------

/**
 * 역할×권한 매트릭스 저장.
 *
 * 폼에서 켜진 체크박스만 전달되므로, 전체 조합을 순회하며 allowed 를 다시 계산한다.
 * 관리자 역할은 시스템에서 잠기는 사고를 막기 위해 항상 전 권한을 유지한다.
 */
export async function updatePermissionMatrixAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await assertPermission('permission:manage');

    const checked = new Set(
      formData
        .getAll('permission')
        .filter((value): value is string => typeof value === 'string'),
    );

    const previous = await prisma.rolePermission.findMany({
      select: { role: true, permission: true, allowed: true },
    });
    const previousAllowed = new Set(
      previous.filter((row) => row.allowed).map((row) => `${row.role}:${row.permission}`),
    );

    const rows: { role: Role; permission: PermissionKey; allowed: boolean }[] = [];
    for (const role of ROLES) {
      for (const permission of ALL_PERMISSIONS) {
        rows.push({
          role,
          permission,
          allowed: role === 'ADMIN' ? true : checked.has(`${role}:${permission}`),
        });
      }
    }

    // 전체를 지우고 다시 심어 부분 갱신 누락으로 정책이 어긋나는 일을 막는다.
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({}),
      prisma.rolePermission.createMany({ data: rows }),
    ]);

    const changed = rows.filter(
      (row) => previousAllowed.has(`${row.role}:${row.permission}`) !== row.allowed,
    );

    await logActivity({
      userId: admin.id,
      action: 'PERMISSION_CHANGE',
      entityType: 'RolePermission',
      summary:
        changed.length > 0
          ? `권한 매트릭스 변경 ${changed.length}건`
          : '권한 매트릭스 저장 (변경 없음)',
      detail: changed.map((row) => ({
        role: row.role,
        permission: row.permission,
        allowed: row.allowed,
      })),
    });

    // 권한은 모든 화면의 메뉴·버튼 노출에 영향을 주므로 전체를 다시 그린다.
    revalidatePath('/', 'layout');

    return {
      success:
        changed.length > 0
          ? `권한 ${changed.length}건이 변경되었습니다.`
          : '변경 사항 없이 저장했습니다.',
    };
  } catch (error) {
    return toActionError(error);
  }
}

/** 조직 정책을 처음부터 다시 잡을 때 쓰는 기본값 복원 */
export async function resetPermissionMatrixAction(): Promise<void> {
  const admin = await assertPermission('permission:manage');

  const rows: { role: Role; permission: PermissionKey; allowed: boolean }[] = [];
  for (const role of ROLES) {
    const defaults = new Set<PermissionKey>(DEFAULT_ROLE_PERMISSIONS[role]);
    for (const permission of ALL_PERMISSIONS) {
      rows.push({ role, permission, allowed: role === 'ADMIN' || defaults.has(permission) });
    }
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({}),
    prisma.rolePermission.createMany({ data: rows }),
  ]);

  await logActivity({
    userId: admin.id,
    action: 'PERMISSION_CHANGE',
    entityType: 'RolePermission',
    summary: '권한 매트릭스를 기본값으로 초기화',
  });

  revalidatePath('/', 'layout');
}
