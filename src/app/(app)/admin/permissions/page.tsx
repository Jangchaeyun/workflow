import type { Metadata } from 'next';
import { Info } from 'lucide-react';

import { requirePermission } from '@/lib/auth';
import { getPermissionMatrixState, getRoleMemberCounts } from '@/data/admin';
import { ALL_PERMISSIONS } from '@/lib/permissions';
import { ROLES } from '@/lib/constants';

import { PageHeader } from '@/components/layout/PageHeader';
import { PermissionMatrixEditor } from '@/components/admin/PermissionMatrixEditor';

export const metadata: Metadata = { title: '권한 관리' };

export default async function AdminPermissionsPage() {
  await requirePermission('permission:manage');

  const [matrix, memberCounts] = await Promise.all([
    getPermissionMatrixState(),
    getRoleMemberCounts(),
  ]);

  return (
    <>
      <PageHeader
        title="권한 관리"
        description={`역할 ${ROLES.length}개 × 권한 ${ALL_PERMISSIONS.length}개의 접근 정책을 직접 조정합니다.`}
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-info/25 bg-info-soft px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <div className="space-y-1 text-xs leading-relaxed text-info">
          <p>
            역할에 기능을 직접 하드코딩하지 않고 <strong>역할 → 권한 → 기능</strong> 구조로
            분리했습니다. 여기서 바꾼 정책은 즉시 메뉴 노출, 버튼 활성화, 데이터 조회 범위에
            반영되며 서버 액션에서도 다시 검증합니다.
          </p>
          <p>
            <strong>시스템 관리자</strong>는 스스로를 시스템에서 잠그는 사고를 막기 위해 항상 모든
            권한을 갖도록 고정되어 있습니다. 권한명을 클릭하면 나머지 역할에 일괄 적용됩니다.
          </p>
        </div>
      </div>

      <PermissionMatrixEditor allowed={matrix.allowed} memberCounts={memberCounts} />
    </>
  );
}
