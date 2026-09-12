import type { Metadata } from 'next';

import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ROLE_LABEL, type Role } from '@/lib/constants';

import { PageHeader } from '@/components/layout/PageHeader';
import { ProfileForms } from '@/components/settings/ProfileForms';

export const metadata: Metadata = { title: '내 프로필' };

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      position: true,
      role: true,
      department: { select: { name: true } },
    },
  });

  if (!record) return null;

  return (
    <>
      <PageHeader
        title="내 프로필"
        description="표시 이름과 연락처, 비밀번호를 관리합니다."
      />
      <ProfileForms
        initial={{
          name: record.name,
          email: record.email,
          phone: record.phone,
          position: record.position,
          departmentName: record.department?.name ?? null,
          roleLabel: ROLE_LABEL[record.role as Role] ?? record.role,
        }}
      />
    </>
  );
}
