'use server';

import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/activity';
import { getCurrentUser } from '@/lib/auth';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';
import { firstIssueMessage, loginSchema, signupSchema } from '@/lib/validators';
import { formToObject, toActionError, type ActionState } from '@/lib/form';
import { USER_STATUS_LABEL, type Role, type UserStatus } from '@/lib/constants';
import { notify } from '@/lib/notifications';

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const nextPath = String(formData.get('next') ?? '') || '/dashboard';

  try {
    const user = await prisma.user.findFirst({
      where: { email: parsed.data.email, deletedAt: null },
    });

    // 계정 존재 여부를 노출하지 않도록 아이디·비밀번호 오류 메시지를 동일하게 유지한다.
    const passwordMatches = user ? await bcrypt.compare(parsed.data.password, user.password) : false;
    if (!user || !passwordMatches) {
      await logActivity({
        action: 'LOGIN',
        entityType: 'Auth',
        entityId: user?.id ?? null,
        userId: user?.id ?? null,
        summary: `로그인 실패 (${parsed.data.email})`,
      });
      return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
    }

    if (user.status !== 'ACTIVE') {
      const label = USER_STATUS_LABEL[user.status as UserStatus] ?? user.status;
      return {
        error:
          user.status === 'PENDING'
            ? '가입 승인 대기 중입니다. 관리자 승인 후 이용할 수 있습니다.'
            : `현재 계정 상태(${label})로는 로그인할 수 없습니다. 관리자에게 문의해주세요.`,
      };
    }

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });

    (await cookies()).set({ ...sessionCookieOptions, value: token });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await logActivity({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'Auth',
      entityId: user.id,
      summary: `${user.name} 로그인`,
    });
  } catch (error) {
    return toActionError(error);
  }

  // redirect 는 내부적으로 예외를 던지므로 try 블록 밖에서 호출한다.
  redirect(nextPath.startsWith('/') ? nextPath : '/dashboard');
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();

  if (user) {
    await logActivity({
      userId: user.id,
      action: 'LOGOUT',
      entityType: 'Auth',
      entityId: user.id,
      summary: `${user.name} 로그아웃`,
    });
  }

  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const { email, password, name, phone, departmentId, position } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: '이미 가입된 이메일입니다.' };

    const created = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
        name,
        phone,
        position,
        departmentId: departmentId ?? null,
        // 자체 가입은 항상 승인 대기 상태로 시작한다.
        role: 'EMPLOYEE',
        status: 'PENDING',
      },
    });

    await logActivity({
      userId: created.id,
      action: 'CREATE',
      entityType: 'User',
      entityId: created.id,
      summary: `가입 신청: ${name} (${email})`,
    });

    // 승인 권한을 가진 관리자에게 알림을 보낸다.
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        notify({
          userId: admin.id,
          type: 'USER_PENDING',
          title: '가입 승인 요청',
          message: `${name}님이 가입 승인을 기다리고 있습니다.`,
          link: '/admin/users?status=PENDING',
        }),
      ),
    );

    return { success: '가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.' };
  } catch (error) {
    return toActionError(error);
  }
}
