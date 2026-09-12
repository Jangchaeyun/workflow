import type { Metadata } from 'next';

import { getMyPermissions, requirePermission } from '@/lib/auth';
import { getDepartmentList } from '@/data/admin';
import { formatCurrencyShort } from '@/lib/utils';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { DepartmentPanel } from '@/components/admin/DepartmentPanel';

export const metadata: Metadata = { title: '부서 관리' };

export default async function AdminDepartmentsPage() {
  await requirePermission('department:manage');

  const [departments, permissions] = await Promise.all([getDepartmentList(), getMyPermissions()]);

  const totalMembers = departments.reduce((sum, row) => sum + row.members.length, 0);
  const unassignedRevenue = departments.reduce((sum, row) => sum + row.wonAmountThisYear, 0);

  return (
    <>
      <PageHeader
        title="부서 관리"
        description="조직도를 구성하고 부서별 인원과 수주 실적을 확인합니다."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="px-5 py-4">
          <p className="text-xs text-ink-faint">부서 수</p>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-ink">{departments.length}개</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-xs text-ink-faint">부서 소속 인원</p>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-ink">{totalMembers}명</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-xs text-ink-faint">올해 부서 수주 합계</p>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-ink">
            {formatCurrencyShort(unassignedRevenue)}
          </p>
        </Card>
      </div>

      <DepartmentPanel
        departments={departments}
        canManage={permissions.has('department:manage')}
      />
    </>
  );
}
