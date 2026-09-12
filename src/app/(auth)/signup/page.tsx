import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = { title: '가입 신청' };

export default async function SignupPage() {
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return <SignupForm departments={departments} />;
}
